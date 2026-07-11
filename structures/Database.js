const Loki = require('lokijs');
const path = require('path');
const fs = require('fs');
const Logger = require('./Logger.js');
const PowerLevels = require('./PowerLevels.js');
const DatabaseHandle = require('./DatabaseHandle.js');
const AtomicFsAdapter = require('./AtomicFsAdapter.js');

const DEFAULT_DATA_DIR = 'data';
const BOT_FILE = 'database.db';

module.exports = class Database {
    /**
     * Registry of database handles. The bot ships a single "bot" handle backed
     * by `database.db` (housing the built-in `users` collection); each module
     * that opts in gets its own handle backed by `data/<Module>.db`.
     * @param {import('..')} client
     */
    constructor(client) {
        this.client = client;
        this.logger = new Logger('DB');
        /** @type {Map<string, DatabaseHandle>} */
        this.handles = new Map();

        this.bot = this.register('bot', {
            file: BOT_FILE,
            collections: ['users'],
            // Unique index on `id`: O(1) `by('id')` lookups (no more linear
            // scans, and no need for the old in-memory userCache) and a DB-level
            // guard against duplicate user rows.
            collectionOptions: { users: { unique: ['id'] } }
        });
    }

    /**
     * Register (or fetch) a named database handle. Idempotent: calling twice
     * with the same name returns the existing handle and ensures any newly
     * requested collections exist.
     * @param {string} name
     * @param {object} [opts]
     * @param {string} [opts.file] Custom file path. Defaults to `data/<name>.db`.
     * @param {string[]} [opts.collections] Collections to ensure on load.
     * @param {object} [opts.collectionOptions] Per-collection Loki options.
     * @param {object} [opts.lokiOptions] Extra Loki constructor options.
     * @returns {DatabaseHandle}
     */
    register(name, opts = {}) {
        const existing = this.handles.get(name);
        if (existing) {
            for (const c of opts.collections || []) existing.collection(c);
            return existing;
        }

        const file = opts.file || path.join(DEFAULT_DATA_DIR, `${name}.db`);
        const handle = new DatabaseHandle(name, { ...opts, file });
        handle.ready().catch(err => {
            this.client.errorHandler?.capture(err, { source: 'lokiAutoload', module: name });
        });
        this.handles.set(name, handle);
        return handle;
    }

    /**
     * @param {string} name
     * @returns {DatabaseHandle | undefined}
     */
    get(name) { return this.handles.get(name); }

    /** Convenience accessor for the bot users collection. */
    get users() { return this.bot.collection('users'); }

    /**
     * Insert a user record, or return the existing one. Idempotent: the unique
     * `id` index makes the lookup O(1) and guarantees a second call for the same
     * id never creates a duplicate row (a raw insert would throw on the unique
     * constraint).
     * @param {String} userID
     * @returns {{ id: string, powerlevel: number, language: string | null }}
     */
    addUser(userID) {
        const existing = this.users.by('id', userID);
        if (existing) return existing;
        return this.users.insert({
            id: userID,
            powerlevel: PowerLevels.USER,
            language: null
        });
    }

    /**
     * @param {String} userID
     * @returns {{ id: string, powerlevel: number, language: string | null } | null}
     */
    getUser(userID) {
        return this.users.by('id', userID) || null;
    }

    /**
     * Fetch a user, creating the record if absent, and reconcile their OWNER
     * power level against the configured owners list. The whole path is
     * synchronous (Loki is in-memory), so there's no await gap for a concurrent
     * call to interleave, and `addUser` is idempotent — no duplicate rows.
     * @param {String} userID
     */
    forceUser(userID) {
        const user = this.getUser(userID) || this.addUser(userID);

        const isOwner = this.client.config.get('owners').includes(userID);
        if (user.powerlevel !== PowerLevels.OWNER && isOwner) {
            user.powerlevel = PowerLevels.OWNER;
            this.users.update(user);
        } else if (user.powerlevel === PowerLevels.OWNER && !isOwner) {
            user.powerlevel = PowerLevels.USER;
            this.users.update(user);
        }
        return user;
    }

    /**
     * Persist changes to a user record. Synchronous — Loki applies the update
     * in memory and the autosave loop flushes it; callers may `await` it
     * harmlessly.
     * @param {{ id: string }} data
     */
    updateUser(data) {
        this.users.update(data);
        return this.users.by('id', data.id);
    }

    /**
     * @param {import('lokijs').Collection} collection
     */
    fixCollection(collection) {
        this.logger.debug('Fixing collection', collection.name);
        const deduplicateSet = new Set();
        const data = collection.data
            .sort((a, b) => a.meta.created - b.meta.created)
            .filter((x) => {
                const duplicated = deduplicateSet.has(x.$loki);
                deduplicateSet.add(x.$loki);
                if (duplicated) this.logger.warn('Detected duplicated key, will remove it');
                return !duplicated;
            })
            .sort((a, b) => a.$loki - b.$loki);

        const index = new Array(data.length);
        for (let i = 0; i < data.length; i += 1) index[i] = data[i].$loki;

        collection.data = data;
        collection.idIndex = index;
        collection.maxId = collection.data?.length
            ? Math.max(...collection.data.map((x) => x.$loki))
            : 0;
        collection.dirty = true;
        collection.checkAllIndexes({ randomSampling: true, repair: true });
        this.logger.success('Done!');
    }

    /**
     * Migrate a legacy monolithic Loki file (everything in `database.db`) into
     * the new per-module file layout. Detects collections named `module_<X>`
     * and `settings_<X>` and copies their rows into the matching per-module
     * handle (collections `default` and `settings` respectively). The `users`
     * collection is left alone since the bot handle already points at the
     * legacy file.
     *
     * @param {object} [opts]
     * @param {string} [opts.source='database.db'] Path to the legacy file.
     * @param {boolean} [opts.dryRun=false] Report what would happen, do nothing.
     * @param {boolean} [opts.removeOriginal=false] Drop the migrated collections from the legacy file after copy.
     * @returns {Promise<{migrated: Array<{module: string, collection: string, rows: number}>, skipped: string[]}>}
     */
    async migrate({ source = BOT_FILE, dryRun = false, removeOriginal = false } = {}) {
        const report = { migrated: [], skipped: [] };

        if (!fs.existsSync(source)) {
            this.logger.warn(`Migration source ${source} does not exist — nothing to do.`);
            return report;
        }

        // If the source is the file the bot handle already has open, reuse
        // that Loki instance — opening a second Loki on the same file would
        // race with bot's autosave.
        const reuseBot = path.resolve(source) === path.resolve(this.bot.file);
        const legacy = reuseBot ? this.bot.db : await this._loadStandalone(source);

        // When reusing the live bot handle, pause its 1s autosave for the whole
        // migration. Otherwise a periodic flush could fire during one of the
        // awaits below and persist a half-migrated state, or contend with the
        // explicit save. Standalone sources are opened with autosave off, so this
        // only matters for the bot handle. Re-enabled in `finally` so a
        // mid-migration throw can't leave the bot DB unable to persist.
        if (reuseBot) legacy.autosaveDisable();
        try {
            const legacyCollections = legacy.listCollections().map(c => c.name);
            this.logger.info(`Found ${legacyCollections.length} collection(s) in ${source}: ${legacyCollections.join(', ') || '(none)'}`);

            for (const colName of legacyCollections) {
                const moduleMatch = colName.match(/^module_(.+)$/);
                const settingsMatch = colName.match(/^settings_(.+)$/);
                if (!moduleMatch && !settingsMatch) {
                    report.skipped.push(colName);
                    continue;
                }

                const moduleName = (moduleMatch || settingsMatch)[1];
                const targetCollection = moduleMatch ? 'default' : 'settings';
                const sourceCol = legacy.getCollection(colName);
                const rows = sourceCol.find();

                this.logger.info(`${dryRun ? '[dry-run] ' : ''}Migrating ${colName} (${rows.length} row${rows.length === 1 ? '' : 's'}) → ${moduleName}/${targetCollection}`);
                report.migrated.push({ module: moduleName, collection: targetCollection, rows: rows.length });

                if (dryRun) continue;

                const handle = this.register(moduleName, { collections: [targetCollection] });
                await handle.ready();
                const targetCol = handle.collection(targetCollection);

                for (const row of rows) {
                    const { $loki, meta, ...clean } = row;
                    targetCol.insert(clean);
                }

                if (removeOriginal) legacy.removeCollection(colName);
            }

            if (!dryRun) {
                // Autosave is paused, so this explicit save is what writes the
                // migrated/cleaned-up state to disk; the re-enabled timer takes
                // over afterwards.
                await new Promise((resolve, reject) => legacy.saveDatabase(err => err ? reject(err) : resolve()));
                if (!reuseBot) await new Promise((resolve) => legacy.close(resolve));
            }

            this.logger.success(`Migration ${dryRun ? 'dry-run ' : ''}complete: ${report.migrated.length} collection(s) migrated, ${report.skipped.length} skipped.`);
            return report;
        } finally {
            if (reuseBot) legacy.autosaveEnable();
        }
    }

    /**
     * Load a Loki file in isolation (not registered with this Database).
     * @private
     * @param {string} file
     * @returns {Promise<import('lokijs')>}
     */
    _loadStandalone(file) {
        return new Promise((resolve, reject) => {
            const db = new Loki(file, {
                autoload: true,
                autosave: false,
                // Same crash-safety as the registered handles: migration rewrites
                // this file (removeOriginal) and a half-written legacy db is the
                // one thing we can't reconstruct.
                adapter: new AtomicFsAdapter({ logger: this.logger }),
                autoloadCallback: (err) => err ? reject(err) : resolve(db)
            });
        });
    }
};
