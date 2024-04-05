const { InteractionType, ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
const { Module } = require('./Module.js');
const Logger = require('./Logger.js');

module.exports = class Command {
    constructor(client, {
        name = 'Unspecified',
        description = 'Unspecified.',
        options = [],
        type = ApplicationCommandType.ChatInput,
        cooldown = 0,
        requiredFlag = [],
        minGuildLevel = 0,
        reqPerms = [],
        botPerms = [],
    }) {
        /** @type {import('..')} */
        this.client = client
        this.config = { name, description, cooldown, requiredFlag, minGuildLevel, reqPerms, botPerms };

        this.data = {
            name,
            description,
            options,
            type
        };

        this.logger = new Logger(this.constructor.name);
    }

    /**
     * @param {BotClient} client 
     * @param {Interaction} interaction 
     * @param {object} args
     * @param {Module} module
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