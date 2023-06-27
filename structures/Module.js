const Discord = require('discord.js');
const fs = require('fs');
const { Collection } = require('lokijs');
const BotClient = require('..');
const PluginPriorities = require('./ModulePriorities');
const ConfigurationManager = require('./ConfigurationManager');
const Logger = require('./Logger');
const chalk = require('chalk');

module.exports = class Module {
    /**
     * @param {BotClient} client 
     * @param {object} options
     * @param {string | string[]} [options.event]
     */
    constructor(client, {
        name = this.constructor.name,
        info = "No description provided.",
        enabled = false,
        event = "ready",
        system = false,
        usesDB = false,
        priority = PluginPriorities.NORMAL,
        config = null
    }) {
        this.client = client;
        this.options = { name, info, enabled, event, system, priority, usesDB };
        
        this.commands = new Discord.Collection();
        this.logger = new Logger(this.options.name);
        if(config)
            this.config = new ConfigurationManager(this, config);
    }

    async loadCommands() {
        const commands = fs.existsSync(`./modules/${this.options.name}`) ? fs.readdirSync(`./modules/${this.options.name}`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('./InteractionCommand')}
                 */
                const command = new (require(`../modules/${this.options.name}/${file}`));
                delete require.cache[require.resolve(`../modules/${this.options.name}/${file}`)];

                this.commands.set(file.split(".")[0], command);
                this.logger.log(`Loaded ${command.interaction ? "interaction " : ''}command ${command.interaction ? "/" : ''}${file.substr(0, file.length-3)} from ${this.options.name}`);
            } catch (e) {
                this.logger.log(`Failed to load command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        }); 
    }

    run(client, event, ...args) {
        // Register automatic event method caller
        if (Array.isArray(this.options.event)) {
            const method = this[event];
            if (!method)
                return this.logger.error(`[${this.options.name}] There was no configured method for the ${event} event.`);
            return method.call(this, client, ...args);
        }
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