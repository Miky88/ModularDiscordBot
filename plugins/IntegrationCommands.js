const Discord = require('discord.js');
const BasePlugin = require("../modules/BasePlugin.js");
const BotClient = require('../index.js');

module.exports = class IntegrationCommands extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "IntegrationCommands",
            info: "Adds integration commands support.",
            enabled: true,
            event: ["ready", "interactionCreate"],
            system: false
        });
    }
    
    /**
     * @param {BotClient} client 
     */
    async ready(client) {
        // Fired on ready
        let currentCommands = await client.application.commands.fetch();
        [...client.PluginManager.slashCommands.values()].forEach(command => {
            if (currentCommands.find(cmd => cmd.name == command.data.name)) return;

            this.log(`Adding command /${command.data.name} to bot`)
            
            client.guilds.cache.forEach(guild => guild.commands.create(command.data))
        });
        [...currentCommands.values()].forEach(cmd => {
            if (this.client.slashCommands.has(cmd.name)) return;
            
            this.log(`Deleting inexistent command /${cmd.name} from bot`)

            client.guilds.cache.forEach(guild => guild.commands.delete(cmd).catch(Function()))
        })
        return;
    }

    /**
     * @param {BotClient} client
     * @param {Discord.CommandInteraction} interaction
     */
    async interactionCreate(client, interaction) {
        if (!interaction.isCommand()) return;

        let [cmd, plugin] = this.client.PluginManager.getSlashCommand(interaction.commandName);
        if (!cmd) return

        let args = interaction.options.data.reduce((obj, option) => {
            obj[option.name] = option.value
            return obj
        }, {});

        await cmd.run(client, interaction, args, plugin);
    }
}