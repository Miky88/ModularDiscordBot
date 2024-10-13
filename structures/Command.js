const { ApplicationCommandType } = require('discord.js');
const Logger = require('./Logger.js');

module.exports = class Command {
    constructor(client, module, {
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
        this.module = module
        // console.log(this.module.constructor.name)
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
     * @returns {Promise<any>}
     */
    run(client, interaction, args) {}

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