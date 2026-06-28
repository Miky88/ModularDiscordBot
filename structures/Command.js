const { ApplicationCommandType, InteractionContextType } = require('discord.js');
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
        defaultMemberPermissions = null, // Array — Discord-native default visibility/usage gate
        contexts = [InteractionContextType.Guild], // Where the command can be invoked; guild-only by default
        moduleName = 'Unspecified'
    }) {
        /** @type {import('../index.js')} */
        this.client = client
        this.module = module
        this.config = { name, description, cooldown, minLevel, defaultMemberPermissions, contexts, moduleName };

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
     * Execute the command. Commands are **terminal** handlers — invoked directly
     * by `InteractionCommandHandler`, not dispatched through the module event
     * chain — so the trailing argument is the owning `module`, not an
     * `EventContext`. (Module event handlers receive `ctx` as their last arg
     * because they participate in propagation and may call `ctx.stopPropagation()`;
     * a command never needs to, since the handler already stops propagation on
     * its behalf once the command has run. See `Module.run`.)
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

        const attachLocsRecursive = (obj, path) => {
            if (!obj?.name) return;
            const nameLoc = this.getLocalizationObject(path + '.name');
            if (nameLoc) {
                obj.nameLocalizations = nameLoc;
                obj.descriptionLocalizations = this.getLocalizationObject(path + '.description');
            }
            if (Array.isArray(obj.options) && obj.options.length) {
                obj.options.forEach(sub => {
                    attachLocsRecursive(sub, `${path}.options.${sub.name}`);
                });
            }
        };

        options.forEach(option => {
            attachLocsRecursive(option, `options.${option.name}`);
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
            defaultMemberPermissions,
            contexts: this.config.contexts,
        };
    }
}
