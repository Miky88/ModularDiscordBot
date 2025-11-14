const Module = require("../structures/Module.js");
const ModulePriorities = require("../structures/ModulePriorities.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true,
            events: ["interactionCreate"],
            settings: {
                defaultServerLanguage: "en-GB"
            }
        })
    }

    /**
     * 
     * @param {import('../index.js')} client 
     * @param {import('discord.js').Interaction} interaction 
     */
    async interactionCreate(client, interaction) {
        if (!interaction.isAutocomplete()) return;
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.commandName == "setlang") {
            return interaction.respond(Object.keys(client.i18n.languages || {}).concat(['default']).map(lang => ({ name: client.i18n.languages[lang]?.name || 'Default', value: lang })));
        }
        if (interaction.commandName == "settings") {
            switch (interaction.options.getFocused(true).name) {
                case "module":
                    let modules = [...client.moduleManager.modules.values()].filter(x=>x.options.settings).map(x=>x.options.name);
                    let options = modules.map(m => ({ name: m, value: m }));
                    return interaction.respond(options);
                case "key":
                    const module = interaction.options.getString("module");
                    const moduleSettings = this.client.moduleManager.modules.get(module).settings
                    if(!moduleSettings) return interaction.respond([])
                    switch (interaction.options.getSubcommand()) {
                        case "add":
                        case "remove":
                            return interaction.respond(Object.keys(moduleSettings.defaultSettings).filter(key => moduleSettings.defaultSettings[key] instanceof Array).map(key => ({ name: key, value: key })))
                        case "set":
                            return interaction.respond(Object.keys(moduleSettings.defaultSettings).filter(key => !(moduleSettings.defaultSettings[key] instanceof Array)).map(key => ({ name: key, value: key })))
                        case "reset":
                            return interaction.respond(Object.keys(moduleSettings.defaultSettings).map(key => ({ name: key, value: key })))
                    }
            }
            
            console.log(interaction);
        }
    }
}
