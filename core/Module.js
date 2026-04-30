const { Collection, BaseInteraction } = require('discord.js');
const fs = require('fs');
const ConfigurationManager = require('./ConfigurationManager');
const SettingsManager = require('./SettingsManager');
const Logger = require('./Logger');

module.exports = class Module {
    /**
     * @param {import('..')} client
     * @param {object} options
     * @param {string}    [options.name]
     * @param {string}    [options.info]
     * @param {string}    [options.version]
     * @param {string[]}  [options.events]                Discord event names this module handles.
     * @param {string[]}  [options.dependencies]          Module names this module needs loaded.
     * @param {string[]}  [options.runBefore]             Modules this one's event handlers should run before.
     * @param {string[]}  [options.runAfter]              Modules this one's event handlers should run after.
     * @param {boolean | string[]} [options.databases]    `true` for a single `default` collection or an array of collection names.
     * @param {object}    [options.config]                Default per-module config schema.
     * @param {object}    [options.settings]              Schema-driven per-guild settings.
     */
    constructor(client, {
        name = this.constructor.name,
        info = "No description provided.",
        version = null,
        events = [],
        dependencies = [],
        runBefore = [],
        runAfter = [],
        databases = false,
        config = null,
        settings = null
    }) {
        this.client = client;

        const declaredCollections = Array.isArray(databases)
            ? [...databases]
            : (databases ? ['default'] : []);

        this.options = {
            name, info, version, events,
            dependencies: [...dependencies],
            runBefore: [...runBefore],
            runAfter: [...runAfter],
            databases,
            collections: declaredCollections,
            settings
        };

        this.commands = new Collection();
        this.logger = new Logger(this.options.name);

        if (config)
            this.config = new ConfigurationManager(this, config);
        if (settings)
            this.settings = new SettingsManager(client, this, settings);
    }

    // ───── lifecycle hooks ─────
    // ModuleManager calls these in a defined order. Default implementations
    // cover the common cases (loading commands on start, clearing on stop);
    // override to add async setup, watch external resources, etc.

    /**
     * Called once after the constructor, before commands or events are wired.
     * Place for one-shot async setup (cache prefill, schema migration, etc.).
     */
    async init(client) {}

    /**
     * Called when the module transitions to the enabled state — at boot for
     * modules persisted as enabled, or via the manager's enable() action.
     * Default: load slash commands so they're discoverable.
     */
    async start(client) {
        await this.loadCommands();
    }

    /**
     * Called when the module transitions to the disabled state, or before an
     * unload. Default: drop the slash-command cache so the manager's
     * aggregate `commands` getter no longer includes them.
     */
    async stop(client) {
        this.commands.clear();
    }

    /**
     * Called once when the module is being unloaded, after stop(). Last
     * chance to release external resources (timers, intervals, sockets).
     */
    async destroy(client) {}

    // ───── i18n ─────

    t(_key, interactionOrLang, vars) {
        let key = `modules.${this.options.name}.${_key}`;

        if (interactionOrLang instanceof BaseInteraction) {
            const interaction = interactionOrLang;
            const i18n = this.client.i18n;

            const utility = this.client.moduleManager.modules.get("Utility")?.settings;
            const guildLang = interaction.guild
                ? utility?.get(interaction.guild.id)?.settings?.defaultServerLanguage
                : null;
            const userData = this.client.database.forceUser(interaction.user.id);

            // Resolution order: user-forced → guild default → Discord interaction locale → bot default.
            let lang = i18n.defaultLang;
            const candidates = [userData?.language, guildLang, interaction.locale];
            for (const candidate of candidates) {
                const resolved = candidate && i18n.resolveLanguage(candidate);
                if (resolved && i18n.languages[resolved]) { lang = resolved; break; }
            }

            return i18n.t(key, lang, vars);
        } else {
            const lang = interactionOrLang || this.client.i18n.defaultLang;
            return this.client.i18n.t(key, lang, vars);
        }
    }

    getLocalizationObject(_key) {
        let key = `modules.${this.options.name}.${_key}`;
        return this.client.i18n.getLocalizationObject(key);
    }

    // ───── commands ─────

    async loadCommands() {
        const commands = fs.existsSync(`./modules/${this.options.name}/commands`) ? fs.readdirSync(`./modules/${this.options.name}/commands`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                const command = require(`../modules/${this.options.name}/commands/${file}`);
                delete require.cache[require.resolve(`../modules/${this.options.name}/commands/${file}`)];
                const _command = new command(this.client, this);

                this.commands.set(file.split(".")[0], _command);
                this.logger.verbose(`Loaded command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        });
    }

    /**
     * Dispatched by ModuleManager. The last argument is an EventContext —
     * call `ctx.stopPropagation()` to prevent later modules from seeing this
     * event in this dispatch round.
     */
    run(client, event, ...rest) {
        const method = this[event];
        if (!method)
            return this.logger.error(`[${this.options.name}] There was no configured method for the ${event} event.`);
        return method.call(this, client, ...rest);
    }

    // ───── database ─────

    /**
     * @type {import('./DatabaseHandle') | null}
     */
    get db() {
        if (this.options.collections.length === 0) return null;
        return this.client.database.get(this.options.name) || null;
    }

    saveData(collectionName, data) {
        if (!this.db)
            throw new Error("You must declare `databases` in module options to use this method.");
        if (!data)
            throw new Error("You must pass a valid argument to data.");

        const collection = this.db.collection(collectionName);
        if (data.$loki) collection.update(data);
        else collection.insert(data);
    }
}
