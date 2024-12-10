const { ApplicationCommandType } = require('discord.js');
const Logger = require('./Logger.js');
const PowerLevels = require('./PowerLevels.js');

module.exports = class Command {
    constructor(client, module, {
        name = 'Unspecified',
        description = 'Unspecified.',
        options = [],
        type = ApplicationCommandType.ChatInput,
        cooldown = 0,
        minLevel = PowerLevels.USER,
        defaultMemberPermissions = null, // Array 
        guildOnly = false,
    }) {
        /** @type {import('..')} */
        this.client = client
        this.module = module
        this.config = { name, description, cooldown, minLevel, defaultMemberPermissions, guildOnly };

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
     * @param {import('../index.js')} client 
     * @param {Interaction} interaction 
     * @param {import('./Module.js')} module 
     * @returns {Promise<any>}
     */
    run(client, interaction, module) {}

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
