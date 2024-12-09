const Discord = require('discord.js');
const Module = require("../structures/Module.js");
const BotClient = require('../index.js');

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            name: "InteractionCommandHandler",
            info: "Adds interaction commands support.",
            enabled: true,
            events: ["ready", "interactionCreate"]
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
                let flags = await client.database.getFlags(interaction.user.id)
                let flag = cmd.config.requiredFlag.find(f => !flags.includes(f))
                if (flag) return interaction.reply({ content: `:no_entry: You don't have required flag **${flag}** to perform this command.`, ephemeral: true})
            }
                        
            await cmd.run(client, interaction);
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
