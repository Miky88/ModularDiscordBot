module.export = class SettingsManager {
    /**
     * Instantiates a settings manager for a specific module
     * @param {import('./Module')} module The module to instantiate the settings manager for
     * @param {object} defaultSettings The default settings for the module
     */
    constructor(module, defaultSettings = {}) {
        this.client = module.client;
        /** @type {import('lokijs')} */
        this.db = client.database.db;
        this.defaultSettings = defaultSettings;

        this.settings = this.db.getCollection(`settings_${module.options.name}`);
        if (!this.settings) {
            this.settings = this.db.addCollection(`settings_${module.options.name}`);
            client.guilds.cache.forEach(guild => {
                this.settings.insert({
                    id: guild.id,
                    settings: defaultSettings
                });
            });
            this.db.saveDatabase();
        }
    }

    /**
     * @param {string} guildID
     * @returns {object}
     */
    get(guildID) {
        const data = this.settings.findOne({ id: guildID });

        if (!data) {
            this.settings.insert({
                id: guildID,
                settings: this.defaultSettings
            });
            this.db.saveDatabase();
            return this.defaultSettings;
        }

        return data.settings;
    }

    set(guildID, key, value) {
        const data = this.settings.findOne({ id: guildID });
        if (!data) {
            this.settings.insert({
                id: guildID,
                settings: this.defaultSettings
            });
            data = this.settings.findOne({ id: guildID });
        }

        data.settings[key] = value;
        this.settings.update(data);
        this.db.saveDatabase();
        return data.settings;
    }

    /**
     * @param {string} guildID
     * @param {string} key
     */
    reset(guildID, key) {
        const data = this.settings.findOne({ id: guildID });
        if (!data) {
            this.settings.insert({
                id: guildID,
                settings: this.defaultSettings
            });
            this.db.saveDatabase();
            return this.defaultSettings;
        }

        data.settings[key] = this.defaultSettings[key];
        this.settings.update(data);
        this.db.saveDatabase();
        return data.settings;
    }

    delete(guildID) {
        const data = this.settings.findOne({ id: guildID });
        if (!data) return false;
        this.settings.remove(data);
        this.db.saveDatabase();
        return true;
    }
}