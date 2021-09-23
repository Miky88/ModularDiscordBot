const Discord = require('discord.js');
const fs = require('fs');
const { Collection } = require('lokijs');
const BotClient = require('..');
const PluginPriorities = require('./PluginPriorities');

module.exports = class BasePlugin {
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
        priority = PluginPriorities.NORMAL
    }) {
        this.client = client;
        this.conf = { enabled, event, system, priority, usesDB };
        this.about = { name, info };
        
        this.commands = new Discord.Collection();
        this.slashCommands = new Discord.Collection();
    }

    async loadCommands() {
        const commands = fs.existsSync(`./commands/${this.about.name}`) ? fs.readdirSync(`./commands/${this.about.name}`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                const command = new (require(`../commands/${this.about.name}/${file}`));
                delete require.cache[require.resolve(`../commands/${this.about.name}/${file}`)];

                if (command.integration)
                    this.slashCommands.set(file.split(".")[0], command);
                else this.commands.set(file.split(".")[0], command);
                this.log(`Loaded ${command.integration ? "integration " : ''}command ${command.integration ? "/" : ''}${file.substr(0, file.length-3)} from ${this.about.name}`);
            } catch (e) {
                this.log(`Failed to load command ${file} from ${this.about.name}: ${e.stack || e}`);
            }
        }); 
    }

    run(client, event, ...args) {
        // Register automatic event method caller
        if (Array.isArray(this.conf.event)) {
            const method = this[event];
            if (!method)
                return console.error(`[${this.about.name}] There was no configured method for the ${event} event.`);
            return method.call(this, client, ...args);
        }
    }

    /**
     * Logs something on the console
     * @param {String} message 
     */
    log(message) {
        console.log(`[${this.constructor.name}] ${message}`)
    }

    /**
     * @type {Collection}
     */
    get db() {
        if (!this.conf.usesDB)
            return null;

        return this.client.database.db[`plugin_${this.about.name}`];
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