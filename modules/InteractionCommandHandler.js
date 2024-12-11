const Discord = require('discord.js');
const Module = require("../structures/Module.js");
const Command = require("../structures/Command.js");
const BotClient = require('../index.js');
const PowerLevels = require('../structures/PowerLevels.js');
const ModulePriorities = require('../structures/ModulePriorities.js');

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            name: "InteractionCommandHandler",
            info: "Adds interaction commands support.",
            enabled: true,
            events: ["ready", "interactionCreate"],
            priority: ModulePriorities.HIGH
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
     * @param {Module} module
     */
    async interactionCreate(client, interaction, module) {
        if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;
        interaction.user.data = await client.database.forceUser(interaction.user.id);

        try {
            /** @type {[Command, Module]} */
            let [cmd, module] = this.client.moduleManager.getCommand(interaction.commandName);
            if (!cmd) return interaction.reply({ content: ":no_entry: Command not found", ephemeral: true });

            if (interaction.user.data.powerlevel < cmd.config.minLevel)
                return interaction.reply({ content: `:no_entry: You don't have permission to use this command. The required permission level is ${Object.keys(PowerLevels).find(k => PowerLevels[k] == cmd.config.minLevel)}`, ephemeral: true });

            await cmd.run(client, interaction, module);
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
