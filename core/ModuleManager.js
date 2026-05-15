const fs = require('fs');
const path = require('path');
const Module = require('./Module.js');
const Logger = require('./Logger.js');
const SettingsManager = require('./SettingsManager.js');

/**
 * Pure data-bag handed to every event handler. Modules call
 * `ctx.stopPropagation()` to prevent later modules from receiving the event
 * during this dispatch round; the manager logs who stopped what.
 */
class EventContext {
    constructor(eventName, manager) {
        this.eventName = eventName;
        this._manager = manager;
        this._stoppedBy = null;
    }
    get propagationStopped() { return this._stoppedBy !== null; }
    /**
     * @param {string} [reason] Optional human-readable reason — appears in logs.
     */
    stopPropagation(reason) {
        if (this._stoppedBy) return;
        this._stoppedBy = { reason: reason || null };
    }
}

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: string, error: string }} Result
 */

/** Error codes returned via Result.code. */
const ERR = {
    NOT_FOUND:        'NOT_FOUND',         // module file isn't on disk
    NOT_LOADED:       'NOT_LOADED',        // module isn't in the registry
    ALREADY_LOADED:   'ALREADY_LOADED',
    LOAD_ERROR:       'LOAD_ERROR',        // exception during construct/init/start
    DEPENDENCY_LOCKED:'DEPENDENCY_LOCKED', // can't unload — others depend on this
    MISSING_DEPENDENCY:'MISSING_DEPENDENCY',
    CYCLIC_DEPENDENCY:'CYCLIC_DEPENDENCY'
};

module.exports = class ModuleManager {
    /**
     * @param {import('..')} client
     */
    constructor(client) {
        this.client = client;
        /** @type {Map<string, Module>} */
        this._modules = new Map();
        /** @type {Set<string>} Discord events the manager has wired to the client. */
        this.events = new Set();
        /** @type {Map<string, Error>} Last load/start error per module name. */
        this.errors = new Map();

        this.logger = new Logger(this.constructor.name);
    }

    /**
     * Discover, construct, init, and start every module on disk in correct
     * topological order. Called once from index.js.
     */
    async init() {
        this.logger.info(`Loading modules...`);
        const names = this._discoverOnDisk();

        // Phase 1: construct so we can read each module's options.dependencies.
        const constructed = new Map(); // name → module instance
        for (const name of names) {
            const result = this._construct(name);
            if (result.ok) constructed.set(name, result.value);
            else this.errors.set(name, new Error(`${result.code}: ${result.error}`));
        }

        // Phase 2: topologically order by dependencies. Reject cycles.
        const order = this._topoSort(
            constructed,
            (m) => m.options.dependencies,
            (m) => m.options.name
        );
        if (!order.ok) {
            this.logger.error(`Module load aborted: ${order.error}`);
            return;
        }

        // Phase 3: validate every dependency exists.
        for (const m of order.value) {
            for (const dep of m.options.dependencies) {
                if (!constructed.has(dep)) {
                    this.errors.set(m.options.name, new Error(`Missing dependency "${dep}"`));
                    this.logger.error(`Skipping ${m.options.name}: missing dependency "${dep}".`);
                }
            }
        }

        // Phase 4: register DB handles, init, then start (if persisted-enabled), in topo order.
        for (const m of order.value) {
            if (this.errors.has(m.options.name)) continue;
            try {
                this._wireDatabase(m);
                this._modules.set(m.options.name, m);
                await m.init(this.client);

                if (this._isEnabledPersisted(m.options.name))
                    await m.start(this.client);

                this.logger.verbose(`${m.options.name} loaded`);
            } catch (err) {
                this.errors.set(m.options.name, err);
                this._modules.delete(m.options.name);
                this.client.errorHandler?.capture(err, { source: 'ModuleManager.init', module: m.options.name });
            }
        }

        // Phase 5: wire Discord event listeners (one per event type).
        this._installEventDispatchers();

        this.logger.success(`Successfully loaded ${this._modules.size} module(s)`);
    }

    /**
     * Load a module that isn't currently in the registry.
     * @returns {Promise<Result<Module>>}
     */
    async load(name) {
        if (this._modules.has(name)) return this._fail(ERR.ALREADY_LOADED, `${name} is already loaded.`);
        if (!this._existsOnDisk(name)) return this._fail(ERR.NOT_FOUND, `${name} is not on disk.`);

        const built = this._construct(name);
        if (!built.ok) return built;
        const mod = built.value;

        // Verify dependencies are satisfiable.
        for (const dep of mod.options.dependencies) {
            if (!this._modules.has(dep) && !this._existsOnDisk(dep))
                return this._fail(ERR.MISSING_DEPENDENCY, `${name} requires "${dep}" which is missing.`);
        }
        // Recursively load any missing dependencies first.
        for (const dep of mod.options.dependencies) {
            if (!this._modules.has(dep)) {
                const r = await this.load(dep);
                if (!r.ok) return this._fail(ERR.MISSING_DEPENDENCY, `Failed to load dependency "${dep}": ${r.error}`);
            }
        }

        try {
            this._wireDatabase(mod);
            this._modules.set(name, mod);
            await mod.init(this.client);
            if (this._isEnabledPersisted(name))
                await mod.start(this.client);

            this._installEventDispatchers();
            this.errors.delete(name);
            this.logger.success(`${name} loaded`);
            return this._ok(mod);
        } catch (err) {
            this.errors.set(name, err);
            this._modules.delete(name);
            this.client.errorHandler?.capture(err, { source: 'ModuleManager.load', module: name });
            return this._fail(ERR.LOAD_ERROR, err.message);
        }
    }

    /**
     * Unload a module.
     * @param {string} name
     * @param {object} [opts]
     * @param {boolean} [opts.force] Cascade-unload anything that depends on this.
     * @returns {Promise<Result<{ unloaded: string[] }>>}
     */
    async unload(name, opts = {}) {
        if (!this._modules.has(name)) return this._fail(ERR.NOT_LOADED, `${name} is not loaded.`);

        const dependents = this._dependentsOf(name);
        if (dependents.length > 0 && !opts.force)
            return this._fail(ERR.DEPENDENCY_LOCKED, `${name} is required by: ${dependents.join(', ')}. Pass force:true to cascade.`);

        const toUnload = opts.force ? [...dependents.reverse(), name] : [name];

        for (const target of toUnload) {
            const mod = this._modules.get(target);
            if (!mod) continue;
            try {
                if (this._isEnabledPersisted(target)) await mod.stop(this.client);
                await mod.destroy(this.client);
            } catch (err) {
                this.client.errorHandler?.capture(err, { source: 'ModuleManager.unload', module: target });
            }
            this._modules.delete(target);
            this.logger.info(`${target} unloaded`);
        }

        await this._unregisterCommandsWithDiscord();
        return this._ok({ unloaded: toUnload });
    }

    /**
     * Stop, destroy, clear require.cache, then load the module fresh. Snapshots
     * the prior enabled state so reload doesn't surprise-disable anything.
     * @returns {Promise<Result<Module>>}
     */
    async reload(name) {
        if (!this._modules.has(name)) return this._fail(ERR.NOT_LOADED, `${name} is not loaded.`);

        const wasEnabled = this._isEnabledPersisted(name);
        const u = await this.unload(name, { force: true });
        if (!u.ok) return u;

        const r = await this.load(name);
        if (!r.ok) return r;

        // unload+load above already respected persisted enable state; reload
        // shouldn't re-disable a manually-disabled module.
        if (wasEnabled !== this._isEnabledPersisted(name))
            this._setEnabledPersisted(name, wasEnabled);

        return r;
    }

    /**
     * Persist enabled = true and call start() if it wasn't already running.
     */
    async enable(name) {
        const mod = this._modules.get(name);
        if (!mod) return this._fail(ERR.NOT_LOADED, `${name} is not loaded.`);
        if (this._isEnabledPersisted(name)) return this._ok(mod);

        try {
            await mod.start(this.client);
            this._setEnabledPersisted(name, true);
            this.logger.success(`${name} enabled`);
            return this._ok(mod);
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'ModuleManager.enable', module: name });
            return this._fail(ERR.LOAD_ERROR, err.message);
        }
    }

    /**
     * Persist enabled = false and call stop() if it was running.
     */
    async disable(name) {
        const mod = this._modules.get(name);
        if (!mod) return this._fail(ERR.NOT_LOADED, `${name} is not loaded.`);
        if (!this._isEnabledPersisted(name)) return this._ok(mod);

        try {
            await mod.stop(this.client);
            this._setEnabledPersisted(name, false);
            this.logger.info(`${name} disabled`);
            return this._ok(mod);
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'ModuleManager.disable', module: name });
            return this._fail(ERR.LOAD_ERROR, err.message);
        }
    }

    isLoaded(name) { return this._modules.has(name); }
    isEnabled(name) { return this._modules.has(name) && this._isEnabledPersisted(name); }
    isOnDisk(name) { return this._existsOnDisk(name); }

    /**
     * @param {string} name
     * @returns {Module | null} The loaded module, or null if not loaded.
     */
    getModule(name) {
        return this._modules.get(name) || null;
    }

    /** All currently loaded modules, regardless of enabled state. */
    allModules() {
        return [...this._modules.values()];
    }

    /** Loaded modules that are persisted as enabled. */
    enabledModules() {
        return this.allModules().filter(m => this._isEnabledPersisted(m.options.name));
    }

    /**
     * Slash commands eligible for global Discord registration. System
     * commands are excluded — they're registered to the configured system
     * guilds by the System module itself, not globally.
     * @returns {Command[]}
     */
    getPublishableCommands() {
        return this.commands.filter(c => c.module.options.name !== 'System');
    }

    /**
     * Aggregated info for inspection / GUI.
     * @returns {Result<{ name, info, version, enabled, loaded, dependencies, dependents, events, commands, lastError }>}
     */
    info(name) {
        const mod = this._modules.get(name);
        if (!mod) {
            if (this._existsOnDisk(name)) return this._ok({
                name, loaded: false, enabled: false,
                lastError: this.errors.get(name)?.message || null
            });
            return this._fail(ERR.NOT_FOUND, `${name} is not on disk.`);
        }
        return this._ok({
            name: mod.options.name,
            info: mod.options.info,
            version: mod.options.version,
            enabled: this._isEnabledPersisted(name),
            loaded: true,
            dependencies: [...mod.options.dependencies],
            dependents: this._dependentsOf(name),
            events: [...mod.options.events],
            commands: [...mod.commands.keys()],
            lastError: this.errors.get(name)?.message || null
        });
    }

    /**
     * Snapshot of every module on disk.
     * @returns {{ loaded: string[], available: string[], failed: { name: string, error: string }[] }}
     */
    list() {
        const onDisk = this._discoverOnDisk();
        const loaded = [...this._modules.keys()];
        const available = onDisk.filter(n => !this._modules.has(n));
        const failed = onDisk
            .filter(n => this.errors.has(n) && !this._modules.has(n))
            .map(n => ({ name: n, error: this.errors.get(n).message }));
        return { loaded, available, failed };
    }

    /**
     * @returns {[Command, Module] | [null, null]}
     */
    getCommand(name) {
        for (const module of this._modules.values()) {
            if (this._isEnabledPersisted(module.options.name) && module.commands?.has(name))
                return [module.commands.get(name), module];
        }
        return [null, null];
    }

    /** Aggregated commands across enabled modules. */
    get commands() {
        const out = [];
        for (const m of this._modules.values()) {
            if (!this._isEnabledPersisted(m.options.name)) continue;
            for (const c of m.commands.values()) out.push(c);
        }
        return out;
    }

    _stateCollection() {
        const handle = this.client.database.get('core');
        return handle.addCollection('module_states');
    }

    _isEnabledPersisted(name) {
        const col = this._stateCollection();
        const rec = col.findOne({ name });
        // Default: enabled if no persisted state.
        return rec ? rec.enabled !== false : true;
    }

    _setEnabledPersisted(name, enabled) {
        const col = this._stateCollection();
        const rec = col.findOne({ name });
        if (rec) {
            rec.enabled = !!enabled;
            col.update(rec);
        } else {
            col.insert({ name, enabled: !!enabled });
        }
    }

    _construct(name) {
        try {
            const modulePath = require.resolve(`@modules/${name}/${name}.js`);
            delete require.cache[modulePath];
            const ModuleClass = require(modulePath);
            const instance = new ModuleClass(this.client);
            return this._ok(instance);
        } catch (err) {
            const msg = err.stack || err.message || String(err);
            this.logger.error(`Failed to construct ${name}: ${msg}`);
            return this._fail(ERR.LOAD_ERROR, err.message || String(err));
        }
    }

    _wireDatabase(mod) {
        const collections = [...mod.options.databases];
        if (mod.options.settings) collections.push('settings');
        if (collections.length > 0)
            this.client.database.register(mod.options.name, { collections });
        if (mod.options.settings && !mod.settings)
            mod.settings = new SettingsManager(this.client, mod, mod.options.settings);
    }

    /**
     * Generic Kahn's-algorithm topological sort.
     * @param {Map<string, T>} items
     * @param {(item: T) => string[]} edgesOf  Returns the names this item depends on (= incoming edges).
     * @param {(item: T) => string} keyOf
     * @returns {Result<T[]>}
     */
    _topoSort(items, edgesOf, keyOf) {
        const order = [];
        const remaining = new Map(items);
        while (remaining.size > 0) {
            // Pick anything whose deps are already placed (or absent from `items`).
            const next = [...remaining.values()].find(item => {
                return edgesOf(item).every(d => !remaining.has(d));
            });
            if (!next) {
                const cycle = [...remaining.keys()].join(', ');
                return this._fail(ERR.CYCLIC_DEPENDENCY, `Cyclic dependency among: ${cycle}`);
            }
            order.push(next);
            remaining.delete(keyOf(next));
        }
        return this._ok(order);
    }

    _dependentsOf(name) {
        return [...this._modules.values()]
            .filter(m => m.options.dependencies.includes(name))
            .map(m => m.options.name);
    }

    _modulesDir() { return path.resolve('./modules'); }

    _discoverOnDisk() {
        const dir = this._modulesDir();
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .filter(name => fs.existsSync(path.join(dir, name, `${name}.js`)));
    }

    _existsOnDisk(name) {
        return fs.existsSync(path.join(this._modulesDir(), name, `${name}.js`));
    }

    _installEventDispatchers() {
        const allEvents = new Set();
        for (const m of this._modules.values())
            for (const e of m.options.events) allEvents.add(e);

        for (const event of allEvents) {
            if (this.events.has(event)) continue;
            this.events.add(event);
            this.client.on(event, async (...args) => {
                const order = this._dispatchOrderFor(event);
                const ctx = new EventContext(event, this);
                for (const mod of order) {
                    if (ctx.propagationStopped) break;
                    if (!this._isEnabledPersisted(mod.options.name)) continue;
                    if (!mod.options.events.includes(event)) continue;
                    try {
                        await mod.run(this.client, event, ...args, ctx);
                    } catch (err) {
                        this.client.errorHandler?.capture(err, { module: mod.options.name, event });
                    }
                }
            });
        }
    }

    /**
     * Topologically order the modules listening on a given event by their
     * runBefore / runAfter constraints. References to non-listeners are
     * ignored. On cycle, fall back to alphabetical with a warning.
     */
    _dispatchOrderFor(event) {
        const listeners = [...this._modules.values()].filter(m => m.options.events.includes(event));
        const names = new Set(listeners.map(m => m.options.name));

        // Build incoming-edge map: edges[X] = names that must run before X.
        const incoming = new Map(listeners.map(m => [m.options.name, new Set()]));
        for (const m of listeners) {
            for (const after of m.options.runAfter || []) {
                if (names.has(after)) incoming.get(m.options.name).add(after);
            }
            for (const before of m.options.runBefore || []) {
                if (names.has(before)) incoming.get(before)?.add(m.options.name);
            }
        }

        // Kahn's algorithm.
        const ordered = [];
        const remaining = new Map(listeners.map(m => [m.options.name, m]));
        while (remaining.size > 0) {
            const ready = [...remaining.keys()].filter(n => incoming.get(n).size === 0).sort();
            if (ready.length === 0) {
                this.logger.warn(`Cyclic runBefore/runAfter for ${event}: ${[...remaining.keys()].join(', ')} — falling back to alphabetical.`);
                ordered.push(...[...remaining.values()].sort((a, b) => a.options.name.localeCompare(b.options.name)));
                break;
            }
            const next = ready[0];
            ordered.push(remaining.get(next));
            remaining.delete(next);
            for (const set of incoming.values()) set.delete(next);
        }
        return ordered;
    }

    /**
     * Re-publish global commands so unloaded modules' slash commands disappear.
     * Re-uses the same filter rule InteractionCommandHandler uses on boot.
     */
    async _unregisterCommandsWithDiscord() {
        try {
            if (!this.client.isReady?.()) return;
            await this.client.application.commands.set(this.getPublishableCommands().map(c => c.toJson()));
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'ModuleManager._unregisterCommandsWithDiscord' });
        }
    }

    _ok(value) { return { ok: true, value }; }
    _fail(code, error) { return { ok: false, code, error }; }

    static get ERR() { return ERR; }
};
