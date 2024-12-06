const Discord = require('discord.js');
const fs = require('fs');
const { Collection } = require('lokijs');
const BotClient = require('..');
const ModulePriorities = require('./ModulePriorities');
const ConfigurationManager = require('./ConfigurationManager');
const SettingsManager = require('./SettingsManager');
const Logger = require('./Logger');
const Database = require('./Database')

module.exports = class Module {
    /**
     * @param {BotClient} client 
     * @param {} options
     * @param {string[]} [options.events]
     */
    constructor(client, {
        name = this.constructor.name,
        info = "No description provided.",
        enabled = false,
        events = [],
        usesDB = false,
        priority = ModulePriorities.NORMAL,
        dependencies = [],
        config = null,
        settings = null
    }) {
        this.client = client;
        this.options = { name, info, enabled, events, priority, usesDB, dependencies, settings};
        
        this.commands = new Discord.Collection();
        this.logger = new Logger(this.options.name);

        // if(usesDB)
        //     client.database.db[`module_${this.options.name}`] = client.database.db.addCollection(`module_${this.options.name}`);

        if(config)
            this.config = new ConfigurationManager(this, config);
        if(settings)
            this.settings = new SettingsManager(client, this, settings);
    }

    async loadCommands() {
        const commands = fs.existsSync(`./modules/${this.options.name}`) ? fs.readdirSync(`./modules/${this.options.name}`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('./Command')}
                 */
                const command = require(`../modules/${this.options.name}/${file}`);
                delete require.cache[require.resolve(`../modules/${this.options.name}/${file}`)];
                const _command = new command(this.client, this);
                
                this.commands.set(file.split(".")[0], _command);
                this.logger.verbose(`Loaded command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        }); 
    }

    run(client, event, ...args) {
        // Register automatic event method caller
        const method = this[event];
        if (!method)
            return this.logger.error(`[${this.options.name}] There was no configured method for the ${event} event.`);
        return method.call(this, client, ...args);
    }

    /**
     * @type {Collection}
     */
    get db() {
        if (!this.options.usesDB)
            return null;

        return this.client.database.db[`plugin_${this.options.name}`];
    }

    saveData(data) {
        if (!this.db)
            throw new Error("You must use usesDB: true to use this method.")
        if (!data)
            throw new Error("You must pass a valid argument to data.")
        
        if (data.$loki)
            this.db.update(data);
        else this.db.add(data);
    }
}