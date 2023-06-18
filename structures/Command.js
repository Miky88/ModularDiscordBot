const { InteractionType, ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
const { Plugin } = require('./Plugin.js');

module.exports = class Command {
    constructor({
        name = 'Unspecified',
        description = 'Unspecified.',
        options = [],
        type = ApplicationCommandType.ChatInput,
        cooldown = 0,
        minLevel = 0,
        reqPerms = [],
        botPerms = [],
    }) {
        this.data = {
            name,
            description,
            options,
            type
        };

        this.config = { name, description, cooldown, minLevel, reqPerms, botPerms };
    }

    /**
     * Logs something on the console
     * @param {String} message 
     */
    log(message) {
        console.log(`[${this.help.name}] ${message}`)
    }

    /**
     * @param {BotClient} client 
     * @param {Interaction} interaction 
     * @param {object} args
     * @param {Plugin} module
     * @returns {Promise<any>}
     */
    run(client, interaction, args, module) {}

    toJson() {
        return (!this.data.type || this.data.type == ApplicationCommandType.ChatInput) ? {
            name: this.data.name,
            description: this.data.description,
            options: this.data.options,
            type: this.data.type
        } : {
            name: this.data.name,
            type: this.data.type
        }
    }
}