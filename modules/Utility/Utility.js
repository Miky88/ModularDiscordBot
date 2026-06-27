const Module = require("@structures/Module.js");
const SettingsUI = require("./lib/SettingsUI.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            events: ["interactionCreate"],
            settings: {
                defaultServerLanguage: {
                    type: 'string',
                    default: '',
                    description: 'Fallback language code for users without a personal preference (e.g., en-GB, it).'
                }
            }
        });

        this.settingsUI = new SettingsUI(this);
    }

    /**
     * @param {import('../../index.js')} client
     * @param {import('discord.js').Interaction} interaction
     */
    async interactionCreate(client, interaction) {
        // Component / modal interactions belonging to the settings GUI (which now
        // also routes the `settings:cperm:*` command-permission sub-views).
        if (interaction.isMessageComponent?.() || interaction.isModalSubmit?.()) {
            const id = interaction.customId || '';
            if (id.startsWith('settings:')) return this.settingsUI.handle(interaction);
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
    }
}
