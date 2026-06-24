const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');
const { safeUpdate, safeError } = require('@core/lib/InteractionHelpers.js');

/**
 * Interactive in-Discord GUI for managing per-guild permission levels.
 * Custom-id convention: `perms:<screen>[:<arg>...]`. State that needs to
 * survive across interactions is encoded into the customId of the next
 * component (Discord components are stateless). All user-facing strings flow
 * through the locale system — see modules/Utility/locales/<lang>.yaml under
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
                case 'home':       return safeUpdate(interaction, this._home(interaction));
                case 'close':      return interaction.update({ content: this._t('errors.closed', interaction), embeds: [], components: [] });
                case 'nav':        return this._nav(interaction, args[0]);
                case 'level':      return this._level(interaction, args);
                case 'role':       return this._role(interaction, args);
                case 'user':       return this._user(interaction, args);
                case 'cmd':        return this._cmd(interaction, args);
                case 'set':        return this._set(interaction, args);
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

        const summary = ladder
            .map(l => `**${l.weight}** · \`${l.id}\` ${l.name}${l.builtin ? defaultTag : ''} — ${l.roles.length} role(s)`)
            .join('\n') || this._t('home.no-levels', interaction);

        const embed = new EmbedBuilder()
            .setTitle(this._t('home.title', interaction))
            .setDescription(this._t('home.description', interaction))
            .addFields(
                { name: this._t('home.current-ladder', interaction), value: summary, inline: false },
                { name: this._t('home.user-overrides', interaction),    value: `${Object.keys(cfg.userOverrides).length}`, inline: true },
                { name: this._t('home.command-overrides', interaction), value: `${Object.keys(cfg.commandOverrides).length}`, inline: true },
                { name: this._t('home.setting-overrides', interaction), value: `${Object.keys(cfg.settingOverrides).length}`, inline: true }
            )
            .setFooter({ text: this._t('home.footer', interaction) });

        const nav = new StringSelectMenuBuilder()
            .setCustomId('perms:nav')
            .setPlaceholder(this._t('home.nav-placeholder', interaction))
            .addOptions(
                { label: this._t('home.nav-levels', interaction), value: 'levels', description: this._t('home.nav-levels-desc', interaction), emoji: '👑' },
                { label: this._t('home.nav-roles', interaction),  value: 'roles',  description: this._t('home.nav-roles-desc', interaction),  emoji: '👥' },
                { label: this._t('home.nav-users', interaction),  value: 'users',  description: this._t('home.nav-users-desc', interaction),  emoji: '👤' },
                { label: this._t('home.nav-cmds', interaction),   value: 'cmds',   description: this._t('home.nav-cmds-desc', interaction),   emoji: '⚡' },
                { label: this._t('home.nav-sets', interaction),   value: 'sets',   description: this._t('home.nav-sets-desc', interaction),   emoji: '⚙️' }
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('perms:close').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.close', interaction)).setEmoji('❌')
        );

        return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(nav), buttons] };
    }

    async _nav(interaction, target) {
        const value = interaction.values?.[0] || target;
        switch (value) {
            case 'levels': return safeUpdate(interaction, this._levelsScreen(interaction));
            case 'roles':  return safeUpdate(interaction, this._rolesScreen(interaction));
            case 'users':  return safeUpdate(interaction, this._usersScreen(interaction));
            case 'cmds':   return safeUpdate(interaction, this._cmdsScreen(interaction));
            case 'sets':   return safeUpdate(interaction, this._setsScreen(interaction));
        }
    }

    _levelsScreen(interaction) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
        const defaultTag = this._t('levels.default-tag', interaction);

        const embed = new EmbedBuilder()
            .setTitle(this._t('levels.title', interaction))
            .setDescription(this._t('levels.description', interaction))
            .addFields({
                name: this._t('levels.current-ladder', interaction),
                value: ladder.map(l =>
                    `**${l.weight}** · \`${l.id}\` — ${l.name}${l.builtin ? defaultTag : ''}\n` +
                    `  ${l.roles.length ? l.roles.map(r => `<@&${r}>`).join(', ') : this._t('levels.no-roles-bound', interaction)}`
                ).join('\n\n') || this._t('levels.no-levels', interaction)
            });

        const components = [];
        if (ladder.length > 0) {
            const editPick = new StringSelectMenuBuilder()
                .setCustomId('perms:level:edit_pick')
                .setPlaceholder(this._t('levels.edit-placeholder', interaction))
                .addOptions(ladder.slice(0, 25).map(l => ({
                    label: `${l.name} (${l.id})`,
                    description: this._t(l.builtin ? 'levels.weight-fmt-default' : 'levels.weight-fmt', interaction, { weight: l.weight }),
                    value: l.id
                })));
            components.push(new ActionRowBuilder().addComponents(editPick));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:level:create_btn').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.create', interaction)).setEmoji('➕'),
            new ButtonBuilder().setCustomId('perms:level:delete_pick').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.delete', interaction)).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    async _level(interaction, args) {
        const [action, ...rest] = args;
        const guildId = interaction.guild.id;

        if (action === 'edit_pick') {
            const levelId = interaction.values[0];
            return this._showLevelModal(interaction, levelId);
        }
        if (action === 'create_btn') {
            return this._showLevelModal(interaction, null);
        }
        if (action === 'create_modal') {
            const id = interaction.fields.getTextInputValue('id').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32);
            const name = interaction.fields.getTextInputValue('name').slice(0, 64);
            const weight = parseInt(interaction.fields.getTextInputValue('weight'), 10);
            if (!id) return safeError(interaction, this._t('levels.empty-id-error', interaction));
            if (!Number.isFinite(weight)) return safeError(interaction, this._t('levels.weight-not-int-error', interaction));
            this.client.permissions.setLevel(guildId, { id, name, weight, roles: [] });
            return safeUpdate(interaction, this._levelsScreen(interaction));
        }
        if (action === 'edit_modal') {
            const levelId = rest[0];
            const name = interaction.fields.getTextInputValue('name').slice(0, 64);
            const weight = parseInt(interaction.fields.getTextInputValue('weight'), 10);
            if (!Number.isFinite(weight)) return safeError(interaction, this._t('levels.weight-not-int-error', interaction));
            this.client.permissions.setLevel(guildId, { id: levelId, name, weight });
            return safeUpdate(interaction, this._levelsScreen(interaction));
        }
        if (action === 'delete_pick') {
            const cfg = this.client.permissions.getConfig(guildId);
            const candidates = [...cfg.levels].sort((a, b) => a.weight - b.weight);
            if (candidates.length === 0)
                return safeError(interaction, this._t('levels.none-to-delete', interaction));

            const embed = new EmbedBuilder()
                .setTitle(this._t('levels.delete-title', interaction))
                .setDescription(this._t('levels.delete-description', interaction));
            const select = new StringSelectMenuBuilder()
                .setCustomId('perms:level:delete_confirm')
                .setPlaceholder(this._t('levels.delete-placeholder', interaction))
                .addOptions(candidates.slice(0, 25).map(l => ({
                    label: `${l.name} (${l.id})`,
                    description: this._t(l.builtin ? 'levels.weight-fmt-default' : 'levels.weight-fmt', interaction, { weight: l.weight }),
                    value: l.id
                })));
            const back = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('perms:nav:levels').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.cancel', interaction)).setEmoji('⬅️')
            );
            return safeUpdate(interaction, { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), back] });
        }
        if (action === 'delete_confirm') {
            const levelId = interaction.values[0];
            this.client.permissions.deleteLevel(guildId, levelId);
            return safeUpdate(interaction, this._levelsScreen(interaction));
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

    _rolesScreen(interaction, focusedLevelId = null) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
        const focused = focusedLevelId ? ladder.find(l => l.id === focusedLevelId) : null;

        const embed = new EmbedBuilder().setTitle(this._t('roles.title', interaction));
        const intro = this._t('roles.intro', interaction);

        if (focused) {
            embed.setDescription(
                intro + '\n\n' +
                this._t('roles.focused-line', interaction, { id: focused.id, name: focused.name, weight: focused.weight }) + '\n' +
                (focused.roles.length
                    ? this._t('roles.bound-list', interaction, { roles: focused.roles.map(r => `<@&${r}>`).join(', ') })
                    : this._t('roles.no-roles-bound', interaction))
            );
        } else {
            embed.setDescription(intro);
            const none = this._t('roles.none', interaction);
            embed.addFields({
                name: this._t('roles.all-levels', interaction),
                value: ladder.map(l =>
                    `\`${l.id}\` — ${l.roles.length ? l.roles.map(r => `<@&${r}>`).join(', ') : none}`
                ).join('\n') || this._t('home.no-levels', interaction)
            });
        }

        const components = [];

        if (focused) {
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`perms:role:bind:${focused.id}`)
                    .setPlaceholder(this._t('roles.bind-placeholder', interaction, { name: focused.name }))
                    .setMinValues(1).setMaxValues(1)
            ));
            if (focused.roles.length > 0) {
                const unbind = new StringSelectMenuBuilder()
                    .setCustomId(`perms:role:unbind:${focused.id}`)
                    .setPlaceholder(this._t('roles.unbind-placeholder', interaction, { name: focused.name }))
                    .addOptions(focused.roles.slice(0, 25).map(roleId => {
                        const role = this.client.guilds.cache.get(guildId)?.roles?.cache?.get(roleId);
                        return { label: role?.name || roleId, description: roleId, value: roleId };
                    }));
                components.push(new ActionRowBuilder().addComponents(unbind));
            }
        }

        const levelPick = new StringSelectMenuBuilder()
            .setCustomId('perms:role:level_pick')
            .setPlaceholder(focused
                ? this._t('roles.level-switch-placeholder', interaction)
                : this._t('roles.level-pick-placeholder', interaction))
            .addOptions(ladder.slice(0, 25).map(l => ({
                label: `${l.name} (${l.id})`,
                description: this._t('roles.level-pick-desc', interaction, { count: l.roles.length, weight: l.weight }),
                value: l.id
            })));
        components.push(new ActionRowBuilder().addComponents(levelPick));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    async _role(interaction, args) {
        const [action, levelId] = args;
        const guildId = interaction.guild.id;

        if (action === 'level_pick') {
            return safeUpdate(interaction, this._rolesScreen(interaction, interaction.values[0]));
        }
        if (action === 'bind') {
            const roleId = interaction.values[0];
            this.client.permissions.bindRole(guildId, levelId, roleId);
            return safeUpdate(interaction, this._rolesScreen(interaction, levelId));
        }
        if (action === 'unbind') {
            const roleId = interaction.values[0];
            this.client.permissions.unbindRole(guildId, levelId, roleId);
            return safeUpdate(interaction, this._rolesScreen(interaction, levelId));
        }
    }

    _usersScreen(interaction, focusedUserId = null) {
        const guildId = interaction.guild.id;
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.userOverrides);

        const embed = new EmbedBuilder()
            .setTitle(this._t('users.title', interaction))
            .setDescription(this._t('users.description', interaction));

        embed.addFields({
            name: this._t('users.active-overrides', interaction),
            value: entries.length
                ? entries.map(([uid, lid]) => `<@${uid}> → \`${lid}\``).join('\n')
                : this._t('users.none', interaction)
        });

        if (focusedUserId) {
            const current = cfg.userOverrides[focusedUserId];
            const suffix = current
                ? this._t('users.selected-user-current', interaction, { level: current })
                : this._t('users.selected-user-empty', interaction);
            embed.addFields({ name: this._t('users.selected-user', interaction), value: `<@${focusedUserId}>${suffix}`, inline: false });
        }

        const components = [];

        components.push(new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('perms:user:pick')
                .setPlaceholder(this._t('users.pick-user-placeholder', interaction))
                .setMinValues(1).setMaxValues(1)
        ));

        if (focusedUserId) {
            const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
            const opts = [
                { label: this._t('users.clear', interaction), value: '__clear__', description: this._t('users.clear-desc', interaction) },
                ...ladder.slice(0, 24).map(l => ({
                    label: `${l.name} (${l.id})`,
                    description: this._t('levels.weight-fmt', interaction, { weight: l.weight }),
                    value: l.id
                }))
            ];
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`perms:user:set:${focusedUserId}`)
                    .setPlaceholder(this._t('users.assign-placeholder', interaction))
                    .addOptions(opts)
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    async _user(interaction, args) {
        const [action, userId] = args;
        const guildId = interaction.guild.id;

        if (action === 'pick') {
            return safeUpdate(interaction, this._usersScreen(interaction, interaction.values[0]));
        }
        if (action === 'set') {
            const value = interaction.values[0];
            this.client.permissions.setUserOverride(guildId, userId, value === '__clear__' ? null : value);
            return safeUpdate(interaction, this._usersScreen(interaction));
        }
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
        return { embeds: [embed], components };
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
        return { embeds: [embed], components };
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
