const { Message } = require("discord.js");
const BotClient = require("..");
const BasePlugin = require("./BasePlugin");
const Command = require("./Command");

class BaseCommand extends Command {
    constructor({
        name = 'Unspecified',
        info = 'Unspecified',
        usage = '',
        aliases = [],
        cooldown = 0,
        minLevel = 0,
        reqPerms = [],
        botPerms = [],
        args = [],
        disabled = false
    }) {
        super(false);
        
        this.help = { name, info, usage };
        this.config = { aliases, cooldown, minLevel, reqPerms, botPerms, args, disabled };
    }

    /**
     * @param {BotClient} client 
     * @param {Message} message 
     * @param {object} args
     * @param {BasePlugin} plugin
     * @returns {Promise<any>}
     */
    run(client, message, args, plugin) {}

    /**
     * Logs something on the console
     * @param {String} message 
     */
    log(message) {
        console.log(`[${this.help.name}] ${message}`)
    }
}

module.exports = BaseCommand;