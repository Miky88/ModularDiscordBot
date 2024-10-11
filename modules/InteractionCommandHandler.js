const Discord = require('discord.js');
const Module = require("../structures/Module.js");
const BotClient = require('../index.js');

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            info: "Adds interaction commands support.",
            enabled: true,
            event: ["ready", "interactionCreate"]
        });
    }
    
    /**
     * @param {BotClient} client 
     */
    async ready(client) {
        client.application.commands
            .set(client.moduleManager.commands.map(c => c.toJson()))
    }

    /**
     * @param {BotClient} client
     * @param {Discord.Interaction} interaction
     */
    async interactionCreate(client, interaction) {
        if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;
        interaction.user.data = await client.database.forceUser(interaction.user.id);

        try {
            let [cmd, plugin] = this.client.moduleManager.getCommand(interaction.commandName);
            if (!cmd) return interaction.reply({ content: ":no_entry: Command not found", ephemeral: true });

            // Required Flag check
            if (cmd.config.requiredFlag.length > 0) {
                let flag = cmd.config.requiredFlag.find(f => !interaction.user.data.flags.includes(f))
                if (flag) return interaction.reply({ content: `:no_entry: You don't have required flag **${flag}** to perform this command.`, ephemeral: true})
            }

            // Guild Permission check
            if (interaction.user.data.guildlevel < cmd.config.minGuildLevel) {
                let reqLevel = client.config.guildlevels.find(pl => pl.level == cmd.config.minGuildLevel)
                let usrLevel = client.config.guildlevels.find(pl => pl.level == interaction.user.data.guildlevel)
                return interaction.reply({ content: `:no_entry: You don't have permission to perform this command. Minimum guild permission required is **${reqLevel.icon} ${reqLevel.level} - ${reqLevel.name}** and your guild permission is **${usrLevel.icon} ${usrLevel.level} - ${usrLevel.name}**`, ephemeral: true})
            }
            
            function extractOptions(options, obj = {}) {
                options.forEach(option => {
                    if (option.value !== undefined) {
                        obj[option.name] = option.value;
                    }
                    if (option.options) {
                        extractOptions(option.options, obj);  // Recursively flatten nested options
                    }
                });
                return obj;
            }
            
            let args = extractOptions(interaction.options.data);
    
            await cmd.run(client, interaction, args, module);  
        } catch (e) {
            interaction.reply({
                content: ":no_entry: Uh-oh, there was an error trying to execute the command, please contact bot developers.",
                ephemeral: true
            })
            this.logger.error(e.stack || e)
        }

        return { cancelEvent: true };
    }
}