const Module = require("@core/Module.js");
const ModulePriorities = require("@core/ModulePriorities.js");
const PermissionsUI = require("./lib/PermissionsUI.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true,
            events: ["interactionCreate"],
            settings: {
                defaultServerLanguage: {
                    type: 'string',
                    default: '',
                    description: 'Fallback language code for users without a personal preference (e.g., en-GB, it).'
                }
            }
        });

        this.permissionsUI = new PermissionsUI(this);
    }

    /**
     * @param {import('../../index.js')} client
     * @param {import('discord.js').Interaction} interaction
     */
    async interactionCreate(client, interaction) {
        // Component / modal interactions belonging to the permissions GUI.
        if ((interaction.isMessageComponent?.() || interaction.isModalSubmit?.()) &&
            interaction.customId?.startsWith('perms:')) {
            return this.permissionsUI.handle(interaction);
        }

        if (!interaction.isAutocomplete()) return;
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.commandName == "setlang") {
            return interaction.respond(Object.keys(client.i18n.languages || {}).concat(['default']).map(lang => ({
                name: lang === 'default' ? 'Default' : client.i18n.languageName(lang),
                value: lang
            })));
        }
        if (interaction.commandName == "settings") {
            switch (interaction.options.getFocused(true).name) {
                case "module":
                    let modules = [...client.moduleManager.modules.values()].filter(x => x.options.settings).map(x => x.options.name);
                    let options = modules.map(m => ({ name: m, value: m }));
                    return interaction.respond(options);
                case "key":
                    const moduleName = interaction.options.getString("module");
                    const moduleSettings = this.client.moduleManager.modules.get(moduleName)?.settings;
                    if (!moduleSettings) return interaction.respond([]);
                    const schema = moduleSettings.schema;
                    const isArrayType = (k) => String(schema[k].type).startsWith('array<');
                    const sub = interaction.options.getSubcommand();
                    const keys = Object.keys(schema);
                    const filtered =
                        sub === 'add' || sub === 'remove' ? keys.filter(isArrayType) :
                        sub === 'set'                     ? keys.filter(k => !isArrayType(k)) :
                        keys;
                    return interaction.respond(filtered.map(k => ({ name: k, value: k })));
            }
        }
    }
}
