const Discord = require('discord.js');
const Module = require("@core/Module.js");
const Command = require("@core/Command.js");
const BotClient = require('../../index.js');
const PowerLevels = require('@core/PowerLevels.js');
const ModulePriorities = require('@core/ModulePriorities.js');

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            name: "InteractionCommandHandler",
            info: "Adds interaction commands support.",
            enabled: true,
            events: ["clientReady", "interactionCreate"],
            priority: ModulePriorities.HIGH
        });
    }
    
    /**
     * @param {BotClient} client 
     */
    async clientReady(client) {
        try {
            await client.application.commands
                .set(client.moduleManager.commands.filter(c => c.module.options.name !== "System").map(c => c.toJson()));
        } catch (err) {
            client.errorHandler?.capture(err, { source: 'commandRegistration', module: this.options.name });
        }
    }

    /**
     * @param {BotClient} client
     * @param {Discord.Interaction} interaction
     * @param {Module} module
     */
    async interactionCreate(client, interaction, module) {
        if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;
        interaction.user.data = await client.database.forceUser(interaction.user.id);

        let cmd, cmdModule;
        try {
            [cmd, cmdModule] = this.client.moduleManager.getCommand(interaction.commandName);
            if (!cmd) {
                await this._safeReply(interaction, { content: ":no_entry: Command not found", flags: [Discord.MessageFlags.Ephemeral] });
                return { cancelEvent: true };
            }

            if (interaction.user.data.powerlevel < cmd.config.minLevel) {
                await this._safeReply(interaction, {
                    content: `:no_entry: You don't have permission to use this command. The required permission level is ${Object.keys(PowerLevels).find(k => PowerLevels[k] == cmd.config.minLevel)}`,
                    flags: [Discord.MessageFlags.Ephemeral]
                });
                return { cancelEvent: true };
            }

            await cmd.run(client, interaction, cmdModule);
        } catch (e) {
            client.errorHandler?.capture(e, {
                module: cmdModule?.options?.name,
                command: cmd?.config?.name || interaction.commandName,
                userId: interaction.user?.id,
                guildId: interaction.guildId || undefined
            });
            await this._safeReply(interaction, {
                content: ":no_entry: Uh-oh, there was an error trying to execute the command, please contact bot developers.",
                flags: [Discord.MessageFlags.Ephemeral]
            });
        }

        return { cancelEvent: true };
    }

    /**
     * Best-effort interaction reply that won't throw if the interaction was
     * already replied/deferred or has expired.
     * @param {Discord.Interaction} interaction
     * @param {Discord.InteractionReplyOptions} payload
     */
    async _safeReply(interaction, payload) {
        try {
            if (interaction.deferred || interaction.replied)
                return await interaction.followUp(payload);
            return await interaction.reply(payload);
        } catch (replyErr) {
            this.client.errorHandler?.capture(replyErr, {
                source: 'safeReply',
                command: interaction.commandName,
                userId: interaction.user?.id,
                severity: 'warn'
            });
        }
    }
}
