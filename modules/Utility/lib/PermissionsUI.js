const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');
const { safeUpdate, safeError } = require('@structures/lib/InteractionHelpers.js');

/**
 * Interactive in-Discord GUI for managing per-guild permission levels.
 *
 * Layout:
 *   home   → pick a level to manage (or create one); shortcut buttons to the
 *            command- and setting-override sections.
 *   level  → one level's detail: its bound Discord roles and its user overrides
 *            (each a pre-filled multi-select — add/remove in place), plus an
 *            Edit modal (name + weight) and, for custom levels, Delete.
 *   cmds   → command overrides.
 *   sets   → setting overrides.
 *
 * Custom-id convention: `perms:<screen>[:<arg>...]`. State that needs to survive
 * across interactions is encoded into the customId of the next component
 * (Discord components are stateless). All user-facing strings flow through the
 * locale system — see modules/Utility/locales/<lang>.yaml under
 * `commands.permissions.ui.*`.
 */
module.exports = class PermissionsUI {
    /**
     * @param {import('../Utility.js')} utilityModule
     */
    constructor(utilityModule) {
        this.module = utilityModule;
        this.client = utilityModule.client;
    }

    /** Localize a UI string under `commands.permissions.ui.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.permissions.ui.${key}`, interaction, vars);
    }

    async open(interaction) {
        await interaction.reply({ ...this._home(interaction), flags: MessageFlags.Ephemeral });
    }

    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async handle(interaction) {
        const id = interaction.customId;
        if (!id?.startsWith('perms:')) return false;
        const parts = id.split(':');
        const screen = parts[1];
        const args = parts.slice(2);

        try {
            switch (screen) {
                case 'home':  return safeUpdate(interaction, this._home(interaction));
                case 'close': return interaction.update({ content: this._t('errors.closed', interaction), embeds: [], components: [] });
                case 'nav':   return this._nav(interaction, args[0]);
                case 'level': return this._level(interaction, args);
                case 'cmd':   return this._cmd(interaction, args);
                case 'set':   return this._set(interaction, args);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'PermissionsUI', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    _home(interaction) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
        const defaultTag = this._t('levels.default-tag', interaction);

        const summary = ladder.map(l => {
            const users = Object.values(cfg.userOverrides).filter(lid => lid === l.id).length;
            return `**${l.weight}** · \`${l.id}\` ${l.name}${l.builtin ? defaultTag : ''} — ` +
                this._t('home.level-counts', interaction, { roles: l.roles.length, users });
        }).join('\n') || this._t('home.no-levels', interaction);

        const embed = new EmbedBuilder()
            .setTitle(this._t('home.title', interaction))
            .setDescription(this._t('home.description', interaction))
            .addFields(
                { name: this._t('home.current-ladder', interaction), value: summary, inline: false },
                { name: this._t('home.command-overrides', interaction), value: `${Object.keys(cfg.commandOverrides).length}`, inline: true },
                { name: this._t('home.setting-overrides', interaction), value: `${Object.keys(cfg.settingOverrides).length}`, inline: true }
            );

        const components = [];
        if (ladder.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('perms:level:pick')
                    .setPlaceholder(this._t('home.pick-placeholder', interaction))
                    .addOptions(ladder.slice(0, 25).map(l => ({
                        label: `${l.name} (${l.id})`,
                        description: this._t(l.builtin ? 'levels.weight-fmt-default' : 'levels.weight-fmt', interaction, { weight: l.weight }),
                        value: l.id
                    })))
            ));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:level:create').setStyle(ButtonStyle.Success).setLabel(this._t('buttons.create', interaction)).setEmoji('➕'),
            new ButtonBuilder().setCustomId('perms:nav:cmds').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.commands', interaction)).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('perms:nav:sets').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.settings', interaction)).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('perms:close').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.close', interaction)).setEmoji('❌')
        ));

        return { content: '', embeds: [embed], components };
    }

    async _nav(interaction, target) {
        switch (target) {
            case 'cmds': return safeUpdate(interaction, this._cmdsScreen(interaction));
            case 'sets': return safeUpdate(interaction, this._setsScreen(interaction));
        }
    }

    /**
     * One level's management view: bound Discord roles and forced user overrides
     * as pre-filled multi-selects, plus Edit / Delete / Back. Falls back to home
     * if the level no longer exists (e.g. deleted in another interaction).
     */
    _levelDetail(interaction, levelId) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const level = cfg.levels.find(l => l.id === levelId);
        if (!level) return this._home(interaction);

        const guild = this.client.guilds.cache.get(guildId);
        // Only pre-select roles that still exist, so a deleted role can't break
        // the select's default values.
        const validRoles = level.roles.filter(rid => guild?.roles?.cache?.has(rid));
        const overriddenUsers = Object.entries(cfg.userOverrides).filter(([, lid]) => lid === levelId).map(([uid]) => uid);
        const tag = level.builtin ? this._t('levels.default-tag', interaction) : '';

        const embed = new EmbedBuilder()
            .setTitle(this._t('level.title', interaction, { name: level.name }))
            .setDescription(this._t('level.summary', interaction, { id: level.id, name: level.name, weight: level.weight, tag }))
            .addFields(
                { name: this._t('level.roles-field', interaction), value: level.roles.length ? level.roles.map(r => `<@&${r}>`).join(', ') : this._t('level.no-roles', interaction) },
                { name: this._t('level.users-field', interaction), value: overriddenUsers.length ? overriddenUsers.map(u => `<@${u}>`).join(', ') : this._t('level.no-users', interaction) }
            );

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId(`perms:level:roles:${level.id}`)
            .setPlaceholder(this._t('level.roles-placeholder', interaction))
            .setMinValues(0).setMaxValues(25);
        if (validRoles.length) roleSelect.setDefaultRoles(...validRoles.slice(0, 25));

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`perms:level:users:${level.id}`)
            .setPlaceholder(this._t('level.users-placeholder', interaction))
            .setMinValues(0).setMaxValues(25);
        if (overriddenUsers.length) userSelect.setDefaultUsers(...overriddenUsers.slice(0, 25));

        const buttons = [
            new ButtonBuilder().setCustomId(`perms:level:edit:${level.id}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.edit', interaction)).setEmoji('✏️')
        ];
        if (!level.builtin)
            buttons.push(new ButtonBuilder().setCustomId(`perms:level:delete:${level.id}`).setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.delete', interaction)).setEmoji('🗑️'));
        buttons.push(new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️'));

        return {
            content: '',
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(roleSelect),
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(...buttons)
            ]
        };
    }

    async _level(interaction, args) {
        const [action, levelId] = args;
        const guildId = interaction.guild.id;

        switch (action) {
            case 'pick':
                return safeUpdate(interaction, this._levelDetail(interaction, interaction.values[0]));

            case 'create':
                return this._showLevelModal(interaction, null);

            case 'create_modal': {
                const id = interaction.fields.getTextInputValue('id').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32);
                const name = interaction.fields.getTextInputValue('name').slice(0, 64);
                const weight = parseInt(interaction.fields.getTextInputValue('weight'), 10);
                if (!id) return safeError(interaction, this._t('levels.empty-id-error', interaction));
                if (!Number.isFinite(weight)) return safeError(interaction, this._t('levels.weight-not-int-error', interaction));
                this.client.permissions.setLevel(guildId, { id, name, weight, roles: [] });
                return safeUpdate(interaction, this._levelDetail(interaction, id));
            }

            case 'edit':
                return this._showLevelModal(interaction, levelId);

            case 'edit_modal': {
                const name = interaction.fields.getTextInputValue('name').slice(0, 64);
                const weight = parseInt(interaction.fields.getTextInputValue('weight'), 10);
                if (!Number.isFinite(weight)) return safeError(interaction, this._t('levels.weight-not-int-error', interaction));
                this.client.permissions.setLevel(guildId, { id: levelId, name, weight });
                return safeUpdate(interaction, this._levelDetail(interaction, levelId));
            }

            case 'roles': {
                const level = this.client.permissions.getLevel(guildId, levelId);
                if (!level) return safeUpdate(interaction, this._home(interaction));
                const selected = new Set(interaction.values);
                const current = new Set(level.roles);
                for (const rid of selected) if (!current.has(rid)) this.client.permissions.bindRole(guildId, levelId, rid);
                for (const rid of current) if (!selected.has(rid)) this.client.permissions.unbindRole(guildId, levelId, rid);
                return safeUpdate(interaction, this._levelDetail(interaction, levelId));
            }

            case 'users': {
                const cfg = this.client.permissions.getConfig(guildId);
                if (!cfg.levels.some(l => l.id === levelId)) return safeUpdate(interaction, this._home(interaction));
                const selected = new Set(interaction.values);
                // Only users currently forced to THIS level — leaving a user
                // overridden to a different level untouched.
                const currentUsers = new Set(Object.entries(cfg.userOverrides).filter(([, lid]) => lid === levelId).map(([uid]) => uid));
                for (const uid of selected) if (!currentUsers.has(uid)) this.client.permissions.setUserOverride(guildId, uid, levelId);
                for (const uid of currentUsers) if (!selected.has(uid)) this.client.permissions.setUserOverride(guildId, uid, null);
                return safeUpdate(interaction, this._levelDetail(interaction, levelId));
            }

            case 'delete':
                this.client.permissions.deleteLevel(guildId, levelId);
                return safeUpdate(interaction, this._home(interaction));
        }
    }

    async _showLevelModal(interaction, levelId) {
        const isEdit = !!levelId;
        const existing = isEdit ? this.client.permissions.getLevel(interaction.guild.id, levelId) : null;
        if (isEdit && !existing) return safeError(interaction, this._t('levels.unknown-level-error', interaction, { level: levelId }));

        const modal = new ModalBuilder()
            .setCustomId(isEdit ? `perms:level:edit_modal:${levelId}` : 'perms:level:create_modal')
            .setTitle(isEdit
                ? this._t('levels.modal-edit-title', interaction, { name: existing.name })
                : this._t('levels.modal-create-title', interaction));

        const inputs = [];
        if (!isEdit) {
            inputs.push(new TextInputBuilder()
                .setCustomId('id').setLabel(this._t('levels.modal-id-label', interaction))
                .setPlaceholder(this._t('levels.modal-id-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32));
        }
        inputs.push(new TextInputBuilder()
            .setCustomId('name').setLabel(this._t('levels.modal-name-label', interaction))
            .setPlaceholder(this._t('levels.modal-name-placeholder', interaction)).setStyle(TextInputStyle.Short)
            .setRequired(true).setMaxLength(64).setValue(existing?.name || ''));
        inputs.push(new TextInputBuilder()
            .setCustomId('weight').setLabel(this._t('levels.modal-weight-label', interaction))
            .setPlaceholder(this._t('levels.modal-weight-placeholder', interaction)).setStyle(TextInputStyle.Short)
            .setRequired(true).setMaxLength(6).setValue(existing ? String(existing.weight) : ''));

        modal.addComponents(...inputs.map(i => new ActionRowBuilder().addComponents(i)));
        await interaction.showModal(modal);
    }

    _cmdsScreen(interaction) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.commandOverrides);

        const embed = new EmbedBuilder()
            .setTitle(this._t('cmds.title', interaction))
            .setDescription(this._t('cmds.description', interaction))
            .addFields({
                name: this._t('cmds.active-overrides', interaction),
                value: entries.length
                    ? entries.map(([c, l]) => `\`/${c}\` → \`${l}\``).join('\n')
                    : this._t('cmds.none', interaction)
            });

        const components = [];
        const buttons = [
            new ButtonBuilder().setCustomId('perms:cmd:set_btn').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.set-override', interaction)).setEmoji('➕')
        ];
        if (entries.length > 0) {
            const clear = new StringSelectMenuBuilder()
                .setCustomId('perms:cmd:clear_pick')
                .setPlaceholder(this._t('cmds.clear-placeholder', interaction))
                .addOptions(entries.slice(0, 25).map(([c, l]) => ({
                    label: `/${c}`, description: this._t('cmds.clear-desc', interaction, { level: l }), value: c
                })));
            components.push(new ActionRowBuilder().addComponents(clear));
        }
        buttons.push(new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️'));
        components.push(new ActionRowBuilder().addComponents(...buttons));
        return { content: '', embeds: [embed], components };
    }

    async _cmd(interaction, args) {
        const [action] = args;
        const guildId = interaction.guild.id;

        if (action === 'set_btn') {
            const modal = new ModalBuilder()
                .setCustomId('perms:cmd:set_modal')
                .setTitle(this._t('cmds.modal-title', interaction));
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('command').setLabel(this._t('cmds.modal-command-label', interaction))
                        .setPlaceholder(this._t('cmds.modal-command-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('level').setLabel(this._t('cmds.modal-level-label', interaction))
                        .setPlaceholder(this._t('cmds.modal-level-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                )
            );
            return interaction.showModal(modal);
        }
        if (action === 'set_modal') {
            const cmd = interaction.fields.getTextInputValue('command').replace(/^\//, '').trim();
            const level = interaction.fields.getTextInputValue('level').trim();
            this.client.permissions.setCommandOverride(guildId, cmd, level);
            return safeUpdate(interaction, this._cmdsScreen(interaction));
        }
        if (action === 'clear_pick') {
            const cmd = interaction.values[0];
            this.client.permissions.setCommandOverride(guildId, cmd, null);
            return safeUpdate(interaction, this._cmdsScreen(interaction));
        }
    }

    _setsScreen(interaction) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.settingOverrides);

        const embed = new EmbedBuilder()
            .setTitle(this._t('sets.title', interaction))
            .setDescription(this._t('sets.description', interaction))
            .addFields({
                name: this._t('sets.active-overrides', interaction),
                value: entries.length
                    ? entries.map(([k, l]) => `\`${k}\` → \`${l}\``).join('\n')
                    : this._t('sets.none', interaction)
            });

        const components = [];
        const buttons = [
            new ButtonBuilder().setCustomId('perms:set:set_btn').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.set-override', interaction)).setEmoji('➕')
        ];
        if (entries.length > 0) {
            const clear = new StringSelectMenuBuilder()
                .setCustomId('perms:set:clear_pick')
                .setPlaceholder(this._t('sets.clear-placeholder', interaction))
                .addOptions(entries.slice(0, 25).map(([k, l]) => ({
                    label: k, description: this._t('sets.clear-desc', interaction, { level: l }), value: k
                })));
            components.push(new ActionRowBuilder().addComponents(clear));
        }
        buttons.push(new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️'));
        components.push(new ActionRowBuilder().addComponents(...buttons));
        return { content: '', embeds: [embed], components };
    }

    async _set(interaction, args) {
        const [action] = args;
        const guildId = interaction.guild.id;

        if (action === 'set_btn') {
            const modal = new ModalBuilder()
                .setCustomId('perms:set:set_modal')
                .setTitle(this._t('sets.modal-title', interaction));
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('key').setLabel(this._t('sets.modal-key-label', interaction))
                        .setPlaceholder(this._t('sets.modal-key-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('level').setLabel(this._t('sets.modal-level-label', interaction))
                        .setPlaceholder(this._t('sets.modal-level-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                )
            );
            return interaction.showModal(modal);
        }
        if (action === 'set_modal') {
            const key = interaction.fields.getTextInputValue('key').trim();
            const level = interaction.fields.getTextInputValue('level').trim();
            this.client.permissions.setSettingOverride(guildId, key, level);
            return safeUpdate(interaction, this._setsScreen(interaction));
        }
        if (action === 'clear_pick') {
            const key = interaction.values[0];
            this.client.permissions.setSettingOverride(guildId, key, null);
            return safeUpdate(interaction, this._setsScreen(interaction));
        }
    }
};
