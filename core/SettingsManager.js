module.exports = class SettingsManager {
    /**
     * Instantiates a settings manager for a specific module. Settings live in
     * the `settings` collection of the module's own database handle.
     * @param {import('..')} client The client to use for the settings manager
     * @param {import('./Module')} module The module to instantiate the settings manager for
     * @param {object} defaultSettings The default settings for the module
     */
    constructor(client, module, defaultSettings = {}) {
        this.client = client;
        this.module = module;
        this.defaultSettings = defaultSettings;
        this._cache = new Map();

        client.settings.set(module.options.name, this);
    }

    /**
     * @returns {import('lokijs').Collection}
     */
    get collection() {
        const handle = this.client.database.get(this.module.options.name)
            || this.client.database.register(this.module.options.name, { collections: ['settings'] });
        return handle.collection('settings');
    }

    /**
     * Internal method to cache settings for a guild
     * @param {String} guildID The ID of the guild to cache the settings for
     * @param {Object} settings The settings to cache
     */
    cache(guildID, settings) {
        this._cache.set(guildID, settings);
    }

    /**
     * @param {String} guildID The ID of the guild to get the settings for and create and cache ones that don't exist
     * @returns {Object} The settings for the specified guild
     */
    get(guildID) {
        const cached = this._cache.get(guildID);
        if (cached) return cached;

        let guildData = this.collection.findOne({ id: guildID });
        if (!guildData)
            guildData = this.collection.insert({ id: guildID, settings: this.defaultSettings });

        this._cache.set(guildID, guildData);
        return guildData;
    }

    /**
     * @param {String} guildID The ID of the guild to set the settings for
     * @param {String} key The key to set the value for
     * @param {String} value The value to set to the key
     */
    set(guildID, key, value) {
        const guildData = this.get(guildID);
        guildData.settings[key] = value;
        this.collection.update(guildData);
        this._cache.set(guildID, guildData);
    }

    /**
     * @param {String} guildID The guild ID to add the settings for
     * @param {String} key Key should represent an array
     * @param {String} value The value to add from the array
     */
    add(guildID, key, value) {
        const guildData = this.get(guildID);
        if (!Array.isArray(guildData.settings[key])) throw new Error("Not an array.");
        guildData.settings[key].push(value);
        this.collection.update(guildData);
        this._cache.set(guildID, guildData);
    }

    /**
     * @param {String} guildID The guild ID to remove the settings for
     * @param {String} key Key should represent an array
     * @param {String} value The value to remove from the array
     */
    remove(guildID, key, value) {
        const guildData = this.get(guildID);
        if (!Array.isArray(guildData.settings[key])) throw new Error("Not an array.");
        guildData.settings[key] = guildData.settings[key].filter(item => item !== value);
        this.collection.update(guildData);
        this._cache.set(guildID, guildData);
    }

    /**
     * Resets the settings of a specific key to its default values
     * @param {String} guildID The guild ID to reset the settings for
     * @param {String} key Key should represent an array
     */
    reset(guildID, key) {
        const guildData = this.get(guildID);
        guildData.settings[key] = this.defaultSettings[key];
        this.collection.update(guildData);
        this._cache.set(guildID, guildData);
    }

    /**
     * Resets the settings of a guild to its default values
     * @param {String} guildID The guild ID to reset the settings for
     */
    factoryReset(guildID) {
        const guildData = this.get(guildID);
        guildData.settings = this.defaultSettings;
        this.collection.update(guildData);
        this._cache.set(guildID, guildData);
    }
}