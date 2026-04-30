const Loki = require('lokijs');
const path = require('path');
const fs = require('fs');
const BotClient = require('../index.js');
const Logger = require('./Logger.js');
const PowerLevels = require('./PowerLevels.js');
const DatabaseHandle = require('./DatabaseHandle.js');

const userCache = new Map();

const DEFAULT_DATA_DIR = 'data';
const CORE_FILE = 'database.db';

module.exports = class Database {
    /**
     * Registry of database handles. The bot ships a single "core" handle backed
     * by `database.db` (housing the built-in `users` collection); each module
     * that opts in gets its own handle backed by `data/<Module>.db`.
     * @param {BotClient} client
     */
    constructor(client) {
        this.client = client;
        this.logger = new Logger('DB');
        /** @type {Map<string, DatabaseHandle>} */
        this.handles = new Map();

        this.core = this.register('core', {
            file: CORE_FILE,
            collections: ['users']
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

    /** Convenience accessor for the core users collection. */
    get users() { return this.core.collection('users'); }

    /**
     * @param {String} userID
     */
    addUser(userID) {
        const user = this.users.insert({
            id: userID,
            powerlevel: PowerLevels.USER,
            language: null
        });
        this.cacheUser(user);
        return user;
    }

    /**
     * @param {import('discord.js').User | { id: string }} user
     */
    cacheUser(user) {
        userCache.set(user.id, user);
    }

    /**
     * @param {String} userID
     */
    getUser(userID) {
        const data = userCache.get(userID) || this.users.findOne({ id: userID });
        if (data) this.cacheUser(data);
        return data;
    }

    /**
     * @param {String} userID
     */
    forceUser(userID) {
        let user = this.getUser(userID);
        if (user) {
            const isOwner = this.client.config.get('owners').includes(userID);
            if (user.powerlevel !== PowerLevels.OWNER && isOwner) {
                user.powerlevel = PowerLevels.OWNER;
                this.updateUser(user);
            } else if (user.powerlevel === PowerLevels.OWNER && !isOwner) {
                user.powerlevel = PowerLevels.USER;
                this.updateUser(user);
            }
            return user;
        }
        return this.addUser(userID);
    }

    /**
     * @param {*} data
     */
    async updateUser(data) {
        delete data.user;
        this.users.update(data);

        const update = this.users.findOne({ id: data.id });
        this.cacheUser(update);
        return update;
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
     * collection is left alone since the core handle already points at the
     * legacy file.
     *
     * @param {object} [opts]
     * @param {string} [opts.source='database.db'] Path to the legacy file.
     * @param {boolean} [opts.dryRun=false] Report what would happen, do nothing.
     * @param {boolean} [opts.removeOriginal=false] Drop the migrated collections from the legacy file after copy.
     * @returns {Promise<{migrated: Array<{module: string, collection: string, rows: number}>, skipped: string[]}>}
     */
    async migrate({ source = CORE_FILE, dryRun = false, removeOriginal = false } = {}) {
        const report = { migrated: [], skipped: [] };

        if (!fs.existsSync(source)) {
            this.logger.warn(`Migration source ${source} does not exist — nothing to do.`);
            return report;
        }

        // If the source is the file the core handle already has open, reuse
        // that Loki instance — opening a second Loki on the same file would
        // race with core's autosave.
        const reuseCore = path.resolve(source) === path.resolve(this.core.file);
        const legacy = reuseCore ? this.core.db : await this._loadStandalone(source);
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
            // Persist legacy changes (only matters if removeOriginal stripped collections).
            // For the reused core handle, the next autosave tick will flush; we still save explicitly to make the cleanup observable immediately.
            await new Promise((resolve, reject) => legacy.saveDatabase(err => err ? reject(err) : resolve()));
            if (!reuseCore) await new Promise((resolve) => legacy.close(resolve));
        }

        this.logger.success(`Migration ${dryRun ? 'dry-run ' : ''}complete: ${report.migrated.length} collection(s) migrated, ${report.skipped.length} skipped.`);
        return report;
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
                autoloadCallback: (err) => err ? reject(err) : resolve(db)
            });
        });
    }
};
