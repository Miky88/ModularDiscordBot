const Discord = require('discord.js');
const BasePlugin = require("../modules/BasePlugin.js");
const fs = require('fs');
const BotClient = require('../index.js');

class SlashCommands extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "SlashCommands",
            info: "Adds slash commands support.",
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

            console.log(`[Slash Commands] Adding command /${command.data.name} to bot`)
            
            client.guilds.cache.forEach(guild => guild.commands.create(command.data))
        });
        [...currentCommands.values()].forEach(cmd => {
            if (this.client.slashCommands.has(cmd.name)) return;
            
            console.log(`[Slash Commands] Deleting inexistent command /${cmd.name} from bot`)

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

        const { powerlevel } = client.database.getUser(interaction.user.id)
        if(!client.config.channelWhitelist.includes(interaction.channel.id) && !client.config.channelWhitelist.includes(interaction.channel.parentId) && powerlevel < 10) {
            return interaction.reply({ content: ":x: Non puoi usare alcun comando in questo canale.", ephemeral: true });
        }

        let [cmd, plugin] = this.client.PluginManager.getSlashCommand(interaction.commandName);
        if (!cmd) return

        let args = interaction.options.data.reduce((obj, option) => {
            obj[option.name] = option.value
            return obj
        }, {});

        await cmd.run(client, interaction, args, plugin);
    }
}

module.exports = SlashCommands;