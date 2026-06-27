const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    MessageFlags, Collection, ApplicationCommandPermissionType
} = require('discord.js');
const { truncate, safeError, errorContainer, pagedSelectRows } = require('@structures/lib/InteractionHelpers.js');

/** Accent bar colour for the command-permission detail container (Discord blurple). */
const ACCENT = 0x5865F2;
/** Max characters for a Components-v2 text display. */
const TEXT_DISPLAY_MAX = 4000;

/**
 * Read-only window onto Discord's **native** per-command permissions, **scoped to
 * a single module's commands**. It is not a standalone screen: SettingsUI renders
 * the command-permissions block directly on the module screen (settings keys
 * above, commands below), so this class supplies that block via `sectionInto()`
 * (Components v2) and owns only the per-command drill-down `detail` screen.
 *
 * The bot owns *visibility + guidance*; Discord owns *enforcement*. There is no
 * parallel permission system: this view `fetch()`es the real per-command
 * overwrites (free on the bot token) and renders them, then hands off to
 * Discord's own Integrations page for editing via a deep-link button.
 *
 *   sectionInto() → adds the commands text + the per-command drill-down select
 *                   (paginated) to the module screen's container, and returns the
 *                   Refresh / Open-Integrations buttons for its bottom button row.
 *   detail        → one command's full allow/deny breakdown + the deep-link.
 *
 * Custom-id convention: the command select is `settings:cperm:detail:<module>`
 * (commandId in the select value); SettingsUI routes the `cperm` screen here.
 * All user-facing strings flow through the locale system — see
 * modules/Utility/locales/<lang>.yaml under `commands.settings.ui.cmdperms.*`.
 *
 * Editing in-bot (writing native perms via an admin's OAuth token — Option E in
 * PERMISSIONS_DESIGN.md) is deliberately **not** built here: it needs a public
 * HTTPS callback + client secret the bot doesn't run. The view degrades to
 * read-only + hand-off, which works on the bot token alone.
 */
module.exports = class CommandPermissionsView {
    /**
     * @param {import('../Utility.js')} utilityModule
     */
    constructor(utilityModule) {
        this.module = utilityModule;
        this.client = utilityModule.client;
    }

    /** Localize a UI string under `commands.settings.ui.cmdperms.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.settings.ui.cmdperms.${key}`, interaction, vars);
    }

    /**
     * REST code returned when a command (or the whole guild) has no explicit
     * permission overwrites. discord.js's own `has`/`add`/`remove` swallow this
     * exact code; a read-only display must treat it as "no overrides", not an
     * error. (`fetch` does NOT return `[]` in this case — it throws.)
     */
    static get UNKNOWN_PERMISSIONS() { return 10066; }

    /**
     * Routed from `SettingsUI.handle` for ids `settings:cperm:...` — only the
     * `detail` drill-down (the command list itself lives on the module screen).
     * @param {import('discord.js').Interaction} interaction
     * @param {string[]} args `[screen, moduleName, ...rest]`
     */
    async handle(interaction, args) {
        const [screen, moduleName, ...rest] = args;
        try {
            if (screen === 'detail') {
                await interaction.deferUpdate();
                const commandId = interaction.isStringSelectMenu?.() ? interaction.values[0] : rest[0];
                return interaction.editReply(await this._detail(interaction, moduleName, commandId));
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'CommandPermissionsView', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    /**
     * Resolve the module's published commands (id → ApplicationCommand) — merging
     * global and guild-scoped registrations so guild-only modules (e.g. System)
     * resolve too — and the guild's native per-command overwrites (commandId →
     * permissions[]). `error` is set when the perms read fails for a reason other
     * than "nothing configured", so the panel can still render (with a warning).
     */
    async _readState(interaction, moduleName) {
        const mod = this.client.modules.getModule(moduleName);
        const names = new Set([...(mod?.commands?.values() || [])].map(c => c.config.name));

        let global = this.client.application.commands.cache;
        if (!global.size) global = await this.client.application.commands.fetch();
        let guildCmds = new Collection();
        try { guildCmds = await interaction.guild.commands.fetch(); } catch { /* no guild commands */ }
        const commandsById = global.concat(guildCmds).filter(c => names.has(c.name));

        try {
            const permsById = await this.client.application.commands.permissions.fetch({ guild: interaction.guild.id });
            return { commandsById, permsById, error: null };
        } catch (err) {
            if (err?.code === CommandPermissionsView.UNKNOWN_PERMISSIONS) {
                return { commandsById, permsById: new Collection(), error: null };
            }
            this.client.errorHandler?.capture(err, { source: 'CommandPermissionsView.fetch', guildId: interaction.guild.id });
            return { commandsById, permsById: new Collection(), error: err };
        }
    }

    /**
     * Add this module's command-permissions block to a Components-v2 `container`
     * (the module screen): a text display (the all-commands default + the current
     * page's commands with their inline native rules, a legend, and any read
     * warning) followed by the paginated per-command drill-down select. Returns
     * the Refresh / Open-Integrations buttons for the screen's bottom button row.
     *
     * The command axis is paginated on the *module* screen's custom-id, so its
     * nav preserves the settings (`keyPage`) axis: `settings:mod:<m>:<keyPage>:<p>`.
     *
     * @param {import('discord.js').ContainerBuilder} container
     * @param {import('discord.js').Interaction} interaction
     * @param {{ moduleName: string, keyPage: number, cmdPage: number }} ctx
     * @returns {Promise<import('discord.js').ButtonBuilder[]>}
     */
    async sectionInto(container, interaction, { moduleName, keyPage = 0, cmdPage = 0 }) {
        const { commandsById, permsById, error } = await this._readState(interaction, moduleName);
        const guild = interaction.guild;
        const commands = [...commandsById.values()].sort((a, b) => a.name.localeCompare(b.name));

        const lines = [];
        // An entry keyed by the application id is the integration-wide "all
        // commands" default toggled from Discord's UI — surface it first (on
        // every page), since it applies to this module's commands too.
        const appSummary = this._overridesInline(interaction, guild, permsById.get(this.client.application.id));
        if (appSummary) lines.push(`- **${this._t('home.all-commands', interaction)}** — ${appSummary}`);

        let selectRows = [];
        let page = 0, pageCount = 1;
        if (commands.length) {
            const paged = pagedSelectRows({
                items: commands,
                page: cmdPage,
                selectId: `settings:cperm:detail:${moduleName}`,
                navId: p => `settings:mod:${moduleName}:${keyPage}:${p}`,
                placeholder: this._t('home.view-placeholder', interaction),
                toOption: c => ({ label: `/${c.name}`, value: c.id })
            });
            ({ rows: selectRows, page, pageCount } = paged);
            for (const cmd of paged.pageItems) {
                // Schematic: "- /name — ✅ … ❌ …", or just the default when there are no overrides.
                const summary = this._overridesInline(interaction, guild, permsById.get(cmd.id));
                lines.push(`- /${cmd.name} — ${summary || this._defaultLabel(interaction, cmd)}`);
            }
        }

        const subs = [this._t('home.readonly', interaction)];
        if (pageCount > 1) subs.push(this._t('pagination', interaction, { page: page + 1, pages: pageCount }));
        let text = `## ${this._t('home.commands-field', interaction)}\n-# ${subs.join(' · ')}\n${lines.join('\n') || this._t('home.none', interaction)}`;
        if (error) text += `\n-# ⚠️ ${this._t('errors.fetch-failed', interaction)}`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(truncate(text, TEXT_DISPLAY_MAX)));
        for (const row of selectRows) container.addActionRowComponents(row);

        return [
            new ButtonBuilder().setCustomId(`settings:mod:${moduleName}:${keyPage}:${cmdPage}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            this._integrationsButton(interaction)
        ];
    }

    async _detail(interaction, moduleName, commandId) {
        const { commandsById, permsById } = await this._readState(interaction, moduleName);
        const cmd = commandsById.get(commandId);
        if (!cmd) return errorContainer({ // dropped from cache between views
            message: this._t('errors.fetch-failed', interaction),
            backId: `settings:mod:${moduleName}`,
            backLabel: this._t('buttons.back', interaction)
        });

        // Schematic: title, a "Default · <label>" line, then ✅/❌ rows (only the
        // ones that have targets), or a small "No overrides" note.
        const summary = this._overrides(interaction, interaction.guild, permsById.get(commandId));
        let text = `## ${this._t('detail.title', interaction, { name: cmd.name })}\n` +
            `${this._t('detail.default', interaction)} · ${this._defaultLabel(interaction, cmd)}`;
        if (!summary) {
            text += `\n-# ${this._t('detail.no-overrides', interaction)}`;
        } else {
            if (summary.allow.length) text += `\n✅ ${summary.allow.join(' ')}`;
            if (summary.deny.length)  text += `\n❌ ${summary.deny.join(' ')}`;
        }

        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(truncate(text, TEXT_DISPLAY_MAX)));
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            this._integrationsButton(interaction),
            new ButtonBuilder().setCustomId(`settings:mod:${moduleName}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));
        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /**
     * Split a command's overwrites into allow/deny mention lists, or null when
     * there are none (defers to the command's default permission).
     * @returns {{allow: string[], deny: string[]} | null}
     */
    _overrides(interaction, guild, perms) {
        if (!perms || !perms.length) return null;
        const allow = [], deny = [];
        for (const p of perms) (p.permission ? allow : deny).push(this._mention(interaction, guild, p));
        return { allow, deny };
    }

    /** One-line "✅ … ❌ …" summary of a command's overwrites, or null. */
    _overridesInline(interaction, guild, perms) {
        const split = this._overrides(interaction, guild, perms);
        if (!split) return null;
        const parts = [];
        if (split.allow.length) parts.push(`✅ ${split.allow.join(' ')}`);
        if (split.deny.length)  parts.push(`❌ ${split.deny.join(' ')}`);
        return truncate(parts.join('   '), 200);
    }

    /** Render one permission overwrite target as a Discord mention / label. */
    _mention(interaction, guild, p) {
        if (p.type === ApplicationCommandPermissionType.Role)
            return p.id === guild.id ? '@everyone' : `<@&${p.id}>`;
        if (p.type === ApplicationCommandPermissionType.User)
            return `<@${p.id}>`;
        if (p.type === ApplicationCommandPermissionType.Channel)
            return p.id === this._allChannelsId(guild) ? this._t('all-channels', interaction) : `<#${p.id}>`;
        return `\`${p.id}\``;
    }

    /** The sentinel id Discord uses for the "All channels" channel constraint. */
    _allChannelsId(guild) {
        return (BigInt(guild.id) - 1n).toString();
    }

    /**
     * Human label for a command's `defaultMemberPermissions` baseline — what
     * applies when there are no explicit overwrites. Crucial caveat: "no
     * overrides" means *defers to this default*, NOT "nobody can use it".
     */
    _defaultLabel(interaction, cmd) {
        const dmp = cmd.defaultMemberPermissions; // PermissionsBitField | null
        if (dmp == null) return this._t('default.everyone', interaction);
        const flags = dmp.toArray();
        if (!flags.length) return this._t('default.admins-only', interaction);
        return this._t('default.requires', interaction, { perms: flags.join(', ') });
    }

    /**
     * Link button straight to this guild's Integrations page, where native
     * command permissions are actually edited (Discord owns enforcement). The
     * per-app sub-route is undocumented/unstable, so we link the reliable list
     * page (the admin clicks the bot → Manage → Command Permissions).
     */
    _integrationsButton(interaction) {
        return new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(this._t('buttons.open-integrations', interaction))
            .setEmoji('🔗')
            .setURL(`discord://-/guilds/${interaction.guild.id}/settings/integrations`);
    }
};
