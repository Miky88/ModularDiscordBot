const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const Logger = require('./Logger.js');

module.exports = class Command {
    constructor(client, module, {
        name = 'Unspecified',
        description = 'Unspecified.',
        options = [],
        type = ApplicationCommandType.ChatInput,
        cooldown = 0,
        requiredFlag = [],
        defaultMemberPermissions = [],
        guildOnly = false,
    }) {
        /** @type {import('..')} */
        this.client = client
        this.module = module
        this.config = { name, description, cooldown, requiredFlag, defaultMemberPermissions, guildOnly };

        this.data = {
            name,
            description,
            options,
            type,
            defaultMemberPermissions
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
        const { name, description, options, type, defaultMemberPermissions } = this.data;
        const isChatInput = !type || type === ApplicationCommandType.ChatInput;
    
        return {
            name,
            type,
            ...(isChatInput && { description, options }),
            defaultMemberPermissions
        };
    }
}