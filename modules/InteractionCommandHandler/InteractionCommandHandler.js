const Discord = require('discord.js');
const Module = require("@core/Module.js");
const Command = require("@core/Command.js");
const PowerLevels = require('@core/PowerLevels.js');

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            name: "InteractionCommandHandler",
            info: "Adds interaction commands support.",
            events: ["clientReady", "interactionCreate"]
        });
    }

    /**
     * @param {import('../../index.js')} client
     */
    async clientReady(client) {
        try {
            await client.application.commands
                .set(client.modules.getPublishableCommands().map(c => c.toJson()));
        } catch (err) {
            client.errorHandler?.capture(err, { source: 'commandRegistration', module: this.options.name });
        }
    }

    /**
     * @param {import('../../index.js')} client
     * @param {Discord.Interaction} interaction
     * @param {import('@core/ModuleManager.js').EventContext} ctx
     */
    async interactionCreate(client, interaction, ctx) {
        if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;
        interaction.user.data = await client.database.forceUser(interaction.user.id);

        let cmd, cmdModule;
        try {
            [cmd, cmdModule] = this.client.modules.getCommand(interaction.commandName);
            if (!cmd) {
                await this._safeReply(interaction, { content: this.t('errors.command-not-found', interaction), flags: [Discord.MessageFlags.Ephemeral] });
                return ctx?.stopPropagation('command not found');
            }

            if (interaction.user.data.powerlevel < cmd.config.minLevel) {
                await this._safeReply(interaction, {
                    content: this.t('errors.insufficient-powerlevel', interaction, {
                        level: Object.keys(PowerLevels).find(k => PowerLevels[k] == cmd.config.minLevel)
                    }),
                    flags: [Discord.MessageFlags.Ephemeral]
                });
                return ctx?.stopPropagation('insufficient powerlevel');
            }

            // Per-guild custom-level override (admin-applied via /permissions).
            // No module-side gate — Discord's `defaultMemberPermissions` is the
            // baseline; this only kicks in when an admin has set `commandOverrides[name]`.
            if (interaction.guild) {
                const ok = client.permissions.check(interaction.member, { commandName: cmd.config.name });
                if (!ok) {
                    await this._safeReply(interaction, {
                        content: this.t('errors.guild-override-denied', interaction),
                        flags: [Discord.MessageFlags.Ephemeral]
                    });
                    return ctx?.stopPropagation('guild override denied');
                }
            }

            const sub = interaction.options.getSubcommand?.(false);
            const grp = interaction.options.getSubcommandGroup?.(false);
            const cmdPath = [cmd.config.name, grp, sub].filter(Boolean).join(' ');
            const where = interaction.guild ? `${interaction.guild.name} (${interaction.guildId})` : 'DM';
            cmdModule.logger.verbose(`/${cmdPath} by ${interaction.user.tag} (${interaction.user.id}) in ${where}`);

            const t0 = Date.now();
            await cmd.run(client, interaction, cmdModule);
            cmdModule.logger.verbose(`/${cmdPath} completed in ${Date.now() - t0}ms`);
        } catch (e) {
            client.errorHandler?.capture(e, {
                module: cmdModule?.options?.name,
                command: cmd?.config?.name || interaction.commandName,
                userId: interaction.user?.id,
                guildId: interaction.guildId || undefined
            });
            await this._safeReply(interaction, {
                content: this.t('errors.execution-error', interaction),
                flags: [Discord.MessageFlags.Ephemeral]
            });
        }

        ctx?.stopPropagation('command handled');
    }

    /**
     * Best-effort interaction reply that won't throw if the interaction was
     * already replied/deferred or has expired.
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
