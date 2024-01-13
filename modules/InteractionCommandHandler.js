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

            // TODO: Could potentially unify system/guild check

            // System Permission check
            if (interaction.user.data.powerlevel < cmd.config.minLevel) {
                let reqLevel = client.config.powerlevels.find(pl => pl.level == cmd.config.minLevel)
                let usrLevel = client.config.powerlevels.find(pl => pl.level == interaction.user.data.powerlevel)
                return interaction.reply({ content: `:no_entry: You don't have permission to perform this command. Minimum system permission required is **${reqLevel.icon} ${reqLevel.level} - ${reqLevel.name}** and your system permission is **${usrLevel.icon} ${usrLevel.level} - ${usrLevel.name}**`, ephemeral: true})
            }

            // Guild Permission check
            if (interaction.user.data.guildlevel < cmd.config.minGuildLevel) {
                let reqLevel = client.config.guildlevels.find(pl => pl.level == cmd.config.minGuildLevel)
                let usrLevel = client.config.guildlevels.find(pl => pl.level == interaction.user.data.guildlevel)
                return interaction.reply({ content: `:no_entry: You don't have permission to perform this command. Minimum guild permission required is **${reqLevel.icon} ${reqLevel.level} - ${reqLevel.name}** and your guild permission is **${usrLevel.icon} ${usrLevel.level} - ${usrLevel.name}**`, ephemeral: true})
            }

            let args = interaction.options.data.reduce((obj, option) => {
                obj[option.name] = option.value
                return obj
            }, {});
    
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