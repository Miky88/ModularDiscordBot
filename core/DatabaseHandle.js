const Loki = require('lokijs');
const path = require('path');
const fs = require('fs');
const Logger = require('./Logger.js');

/**
 * Wraps a single Loki database file and the named collections inside it.
 * Created via Database.register() — modules should not instantiate directly.
 */
module.exports = class DatabaseHandle {
    /**
     * @param {string} name Logical name (usually the module name, or 'core')
     * @param {object} opts
     * @param {string} opts.file Absolute or relative path to the Loki file
     * @param {string[]} [opts.collections] Collections to ensure on load
     * @param {object} [opts.collectionOptions] Map of collectionName -> Loki addCollection options
     * @param {object} [opts.lokiOptions] Extra options forwarded to the Loki constructor
     */
    constructor(name, { file, collections = [], collectionOptions = {}, lokiOptions = {} } = {}) {
        this.name = name;
        this.file = file;
        this.logger = new Logger(`DB:${name}`);
        this._declared = new Set(collections);
        this._collectionOptions = collectionOptions;

        const dir = path.dirname(file);
        if (dir && dir !== '.' && !fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });

        this._ready = new Promise((resolve, reject) => {
            this.db = new Loki(file, {
                autoload: true,
                autosave: true,
                autosaveInterval: 1000,
                ...lokiOptions,
                autoloadCallback: (err) => {
                    if (err) return reject(err);
                    for (const c of this._declared) this._ensure(c);
                    this.logger.verbose(`Loaded (${this._declared.size} collection${this._declared.size === 1 ? '' : 's'})`);
                    resolve(this);
                }
            });
        });
    }

    _ensure(collectionName) {
        let col = this.db.getCollection(collectionName);
        if (!col) col = this.db.addCollection(collectionName, this._collectionOptions[collectionName]);
        return col;
    }

    /**
     * Resolves once the underlying Loki file has finished autoloading.
     * @returns {Promise<this>}
     */
    ready() { return this._ready; }

    /**
     * Get a named collection, creating it on demand if it wasn't declared upfront.
     * @param {string} name
     * @returns {import('lokijs').Collection}
     */
    collection(name) {
        if (!this._declared.has(name)) this._declared.add(name);
        return this._ensure(name);
    }

    /**
     * Add (or expose) a collection with explicit options.
     * @param {string} name
     * @param {object} [options]
     */
    addCollection(name, options) {
        this._declared.add(name);
        if (options) this._collectionOptions[name] = options;
        let col = this.db.getCollection(name);
        if (!col) col = this.db.addCollection(name, options);
        return col;
    }

    /**
     * Names of every collection currently registered with this handle.
     */
    listCollections() {
        return this.db.listCollections().map(c => c.name);
    }

    /**
     * Proxy access (e.g. handle.users) — returns the named collection if it exists.
     * Provided for convenience; prefer collection(name) for clarity.
     */
    static proxy(handle) {
        return new Proxy(handle, {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (typeof prop === 'string' && target._declared.has(prop))
                    return target._ensure(prop);
                return undefined;
            }
        });
    }
};
