const Module = require("../structures/Module.js");
const ModulePriorities = require("../structures/ModulePriorities.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true,
            events: ["interactionCreate"],
        })
    }

    async interactionCreate(client, interaction) {
        if (!interaction.isAutocomplete()) return;
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.commandName == "settings") {
            const module = interaction.options.getString("module");
            const moduleSettings = this.client.moduleManager.modules.get(module).settings
            switch (interaction.options.getSubcommand()) {
                case "add":
                case "remove":
                    return interaction.respond(Object.keys(moduleSettings.defaultSettings).filter(key => moduleSettings.defaultSettings[key] instanceof Array).map(key => ({ name: key, value: key })))
                case "set":
                    return interaction.respond(Object.keys(moduleSettings.defaultSettings).filter(key => !(moduleSettings.defaultSettings[key] instanceof Array)).map(key => ({ name: key, value: key })))
                case "reset":
                    return interaction.respond(Object.keys(moduleSettings.defaultSettings).map(key => ({ name: key, value: key })))
            }

            console.log(interaction);
        }
    }
}