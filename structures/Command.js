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
        moduleName = 'Unspecified'
    }) {
        /** @type {import('..')} */
        this.client = client
        this.module = module
        this.config = { name, description, cooldown, minLevel, defaultMemberPermissions, guildOnly, moduleName };

        this.data = {
            name,
            description,
            options,
            type,
            defaultMemberPermissions,
            moduleName
        };

        this.logger = new Logger(this.constructor.name);
    }

    t(_key, interactionOrLang, vars) {
        let key = `commands.${this.config.name}.${_key}`;
        return this.module.t(key, interactionOrLang, vars);
    }

    getLocalizationObject(_key) {
        let key = `commands.${this.config.name}.${_key}`;
        return this.module.getLocalizationObject(key);
    }

    /**
     * @param {import('../index.js')} client 
     * @param {Interaction} interaction 
     * @param {import('./Module.js')} module 
     * @returns {Promise<any>}
     */
    run(client, interaction, module) {}

    toJson() {
        const { name, description, options, type, defaultMemberPermissions, moduleName } = this.data;
        const isChatInput = !type || type === ApplicationCommandType.ChatInput;
    
        let nameLocalizations = this.getLocalizationObject('name');
        let descriptionLocalizations = isChatInput ? this.getLocalizationObject('description') : null;

        options.forEach(option => {
            if (option.name) {
                const optionNameLoc = this.getLocalizationObject(`options.${option.name}.name`);
                if (optionNameLoc) {
                    option.nameLocalizations = optionNameLoc;
                }
            }
        });

        return {
            name,
            nameLocalizations,
            type,
            ...(isChatInput && {
                description,
                descriptionLocalizations: descriptionLocalizations,
                options
            }),
            defaultMemberPermissions
        };
    }
}
