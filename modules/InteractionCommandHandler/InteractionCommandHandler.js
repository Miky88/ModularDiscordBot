const Discord = require('discord.js');
const Module = require("@structures/Module.js");
const Command = require("@structures/Command.js");
const PowerLevels = require('@structures/PowerLevels.js');
const { safeReply } = require('@structures/lib/InteractionHelpers.js');

/** How often to evict expired per-user cooldown entries. */
const COOLDOWN_SWEEP_MS = 60_000;

module.exports = class InteractionCommandHandler extends Module {
    constructor(client) {
        super(client, {
            name: "InteractionCommandHandler",
            info: "Adds interaction commands support.",
            events: ["clientReady", "interactionCreate"]
        });

        /**
         * Per-`(user, command)` cooldown expiries, in epoch ms.
         * Key: `${userId}:${commandName}`. Bounded by lazy deletion on hit plus
         * a periodic sweep (see `start`/`stop`).
         * @type {Map<string, number>}
         */
        this._cooldowns = new Map();
    }

    async start(client) {
        await super.start(client);
        if (this._cooldownSweeper) clearInterval(this._cooldownSweeper);
        this._cooldownSweeper = setInterval(() => this._sweepCooldowns(), COOLDOWN_SWEEP_MS);
        this._cooldownSweeper.unref?.();
    }

    async stop(client) {
        if (this._cooldownSweeper) {
            clearInterval(this._cooldownSweeper);
            this._cooldownSweeper = null;
        }
        await super.stop(client);
    }

    _sweepCooldowns() {
        const now = Date.now();
        for (const [key, expiry] of this._cooldowns) {
            if (expiry <= now) this._cooldowns.delete(key);
        }
    }

    /**
     * Returns the remaining cooldown for this user+command in ms, or 0 if the
     * command is off cooldown (in which case the cooldown is (re)armed).
     * Owners bypass cooldowns entirely.
     * @param {Discord.Interaction} interaction
     * @param {Command} cmd
     * @returns {number}
     */
    _cooldownRemaining(interaction, cmd) {
        const seconds = Number(cmd.config.cooldown) || 0;
        if (seconds <= 0) return 0;
        if ((interaction.user.data?.powerlevel ?? 0) >= PowerLevels.OWNER) return 0;

        const key = `${interaction.user.id}:${cmd.config.name}`;
        const now = Date.now();
        const expiry = this._cooldowns.get(key);
        if (expiry && expiry > now) return expiry - now;

        this._cooldowns.set(key, now + seconds * 1000);
        return 0;
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
     * @param {import('@structures/ModuleManager.js').EventContext} ctx
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

            const dmAllowed = cmd.config.contexts.includes(Discord.InteractionContextType.BotDM)
                || cmd.config.contexts.includes(Discord.InteractionContextType.PrivateChannel);
            if (!dmAllowed && !interaction.guild) {
                await this._safeReply(interaction, {
                    content: this.t('errors.guild-only', interaction),
                    flags: [Discord.MessageFlags.Ephemeral]
                });
                return ctx?.stopPropagation('guild only');
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

            // Rate limit per (user, command). Checked after auth so denied
            // users never arm a cooldown; owners bypass.
            const cooldownMs = this._cooldownRemaining(interaction, cmd);
            if (cooldownMs > 0) {
                await this._safeReply(interaction, {
                    content: this.t('errors.cooldown', interaction, { time: Math.ceil(cooldownMs / 1000) }),
                    flags: [Discord.MessageFlags.Ephemeral]
                });
                return ctx?.stopPropagation('on cooldown');
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
        return safeReply(interaction, payload, (replyErr) =>
            this.client.errorHandler?.capture(replyErr, {
                source: 'safeReply',
                command: interaction.commandName,
                userId: interaction.user?.id,
                severity: 'warn'
            }));
    }
}
