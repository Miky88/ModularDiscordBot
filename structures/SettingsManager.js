
const _cache = new Map();

module.exports = class SettingsManager {
    /**
     * Instantiates a settings manager for a specific module
     * @param {import('../')} client The client to use for the settings manager
     * @param {import('./Module')} module The module to instantiate the settings manager for
     * @param {object} defaultSettings The default settings for the module
     */
    constructor(client, module, defaultSettings = {}) {
        this.client = client;
        this.dbName = `settings_${module.options.name}`;
        this.module = module;
        this.defaultSettings = defaultSettings;
        
        client.settings.set(module.options.name, this);
    }

    /*
    this.db.data [
        { // "guildData"
            "id": guildID,
            "settings": Object (settings: defaultSettings)
        }
    ]
    this.cache = Map<guildID, guildData>
     */

    cache(guildID, settings) {
        _cache.set(guildID, settings);
    }

    get(guildID) {
        
        const cached = _cache.get(guildID);
        if (cached) return cached;

        let guildData = this.client.database.db[this.dbName].findOne({ id: guildID });
        if (!guildData) 
            guildData = this.client.database.db[this.dbName].insert({ id: guildID, settings: this.defaultSettings });

        _cache.set(guildID, guildData);
        return guildData;
    }

    set(guildID, key, value) {
        const guildData = this.get(guildID);
        guildData.settings[key] = value;
        this.client.database.db[this.dbName].update(guildData);
        _cache.set(guildID, guildData);
    }
}