const { ThreadOnlyChannel } = require('discord.js');

module.exports = class SettingsManager {
    /**
     * Instantiates a settings manager for a specific module
     * @param {import('./Module')} module The module to instantiate the settings manager for
     * @param {object} defaultSettings The default settings for the module
     */
    constructor(module, defaultSettings = {}) {

        /** @type {import('lokijs').Collection }*/
        this.db = module.client.database.db[`settings_${module.options.name}`]
        this.settings = this.db;
        this.module = module;
        this.defaultSettings = defaultSettings;
        
        /*
        Database
            -> settings_System
                -> [
                    {
                        id: "89345834095834",
                        settings: {}
                    }
                ]
        */

        module.client.settings.set(module.options.name, this);
    }

    /**
     * @param {string} guildID
     * @returns {object}
     */
    get(guildID) {
        const data = this.db.findOne({ id: guildID });
        return data ? data.settings : this.defaultSettings;
    }

    async set(guildID, key, value) {
        let data = this.db.findOne({id: guildID});
        if (!data) {
            this.db.insert({
                id: guildID,
                settings: this.defaultSettings
            })
            data = this.db.findOne({id: guildID})
        }
        data.settings[key] = value;
        this.db.insert({
            id: guildID,
            settings: data.settings
        })
        this.db.update(data);
        console.log(this.db.findOne({id: guildID}))
        await this.save()
    }

    /**
     * @param {string} guildID
     * @param {string} key
     */
    async reset(guildID, key) {
        let data = this.db.findOne({id: guildID});
        if (!data) return;
        data.settings[key] = this.defaultSettings[key];
        this.db.update(data);
        await this.save()
    }

    async add(guildID, key, value){    
        let data = this.db.findOne({id: guildID});
        if (!data) {
            this.db.insert({
                id: guildID,
                settings: this.defaultSettings
            })
        }
        if(!Array.isArray(data.settings[key])) throw new Error("Not an array.")
        data.settings[key].push(value);
        this.db.update(data);
        await this.save()
    }

    async remove(guildID, key, value){
        let data = await this.db.findOne({id: guildID});
        if(!Array.isArray(data.settings[key])) throw new Error("Not an array.")
        arr = data.settings[key].filter(function(item) {
            return item !== value
        })
        await this.db.update(data);
        await this.save()
    }

    async delete(guildID) {
        let data = this.db.findOne({id: guildID});
        if(!data) return false;
        await this.db.remove(data);
        await this.save()
        return;
    }
}