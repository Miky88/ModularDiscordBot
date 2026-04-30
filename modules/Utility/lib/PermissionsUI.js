const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags, ComponentType
} = require('discord.js');

/**
 * Interactive in-Discord GUI for managing per-guild permission levels.
 * Replaces the previous 8-subcommand /permissions interface with a single
 * panel message that re-renders in place as the admin navigates.
 *
 * Custom-id convention: `perms:<screen>[:<arg>...]`. State that needs to
 * survive across interactions is encoded into the customId of the next
 * component (Discord components are stateless).
 */
module.exports = class PermissionsUI {
    /**
     * @param {import('../Utility.js')} utilityModule
     */
    constructor(utilityModule) {
        this.module = utilityModule;
        this.client = utilityModule.client;
    }

    /** Slash command entry point — open the main panel ephemerally. */
    async open(interaction) {
        await interaction.reply({ ...this._home(interaction.guild.id), flags: MessageFlags.Ephemeral });
    }

    /**
     * Top-level dispatcher. Returns true if this UI handled the interaction.
     * @param {import('discord.js').Interaction} interaction
     */
    async handle(interaction) {
        const id = interaction.customId;
        if (!id?.startsWith('perms:')) return false;
        const parts = id.split(':');                  // ['perms', 'screen', ...]
        const screen = parts[1];
        const args = parts.slice(2);

        try {
            switch (screen) {
                case 'home':       return this._update(interaction, this._home(interaction.guild.id));
                case 'close':      return interaction.update({ content: 'Closed.', embeds: [], components: [] });
                case 'nav':        return this._nav(interaction, args[0]);
                case 'level':      return this._level(interaction, args);
                case 'role':       return this._role(interaction, args);
                case 'user':       return this._user(interaction, args);
                case 'cmd':        return this._cmd(interaction, args);
                case 'set':        return this._set(interaction, args);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'PermissionsUI', userId: interaction.user?.id });
            await this._safeError(interaction, err.message);
        }
        return true;
    }

    _home(guildId) {
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);

        const summary = ladder
            .map(l => `**${l.weight}** · \`${l.id}\` ${l.name}${l.builtin ? ' *(default)*' : ''} — ${l.roles.length} role(s)`)
            .join('\n') || '_(no levels)_';

        const embed = new EmbedBuilder()
            .setTitle('🔐 Permissions')
            .setDescription(
                'Per-guild permission system. Admins define **levels** (a ladder of named ' +
                'tiers with numeric weights), then bind Discord roles to those levels. ' +
                'Module-side commands and settings stay open by default; you can re-gate ' +
                'individual ones via overrides.\n\n' +
                '**Resolver order** (first match wins):\n' +
                '`1.` Bot OWNER\n' +
                '`2.` Guild owner\n' +
                '`3.` Discord `Administrator` permission\n' +
                '`4.` Member\'s effective level (max over bound roles + user override) ' +
                '≥ the level required by an override (if any). With no override set, access is allowed.'
            )
            .addFields(
                { name: 'Current ladder', value: summary, inline: false },
                { name: 'User overrides', value: `${Object.keys(cfg.userOverrides).length}`, inline: true },
                { name: 'Command overrides', value: `${Object.keys(cfg.commandOverrides).length}`, inline: true },
                { name: 'Setting overrides', value: `${Object.keys(cfg.settingOverrides).length}`, inline: true }
            )
            .setFooter({ text: 'Tip: pick a section below to manage levels, role bindings, or overrides.' });

        const nav = new StringSelectMenuBuilder()
            .setCustomId('perms:nav')
            .setPlaceholder('What would you like to manage?')
            .addOptions(
                { label: 'Levels',            value: 'levels', description: 'Create, rename, reweight, delete levels.', emoji: '👑' },
                { label: 'Role bindings',     value: 'roles',  description: 'Bind or unbind roles to levels.',          emoji: '👥' },
                { label: 'User overrides',    value: 'users',  description: 'Force a specific level on a user.',        emoji: '👤' },
                { label: 'Command overrides', value: 'cmds',   description: 'Re-gate a slash command in this guild.',   emoji: '⚡' },
                { label: 'Setting overrides', value: 'sets',   description: 'Re-gate a Module.key setting.',            emoji: '⚙️' }
            );

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Refresh').setEmoji('🔄'),
            new ButtonBuilder().setCustomId('perms:close').setStyle(ButtonStyle.Danger).setLabel('Close').setEmoji('❌')
        );

        return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(nav), buttons] };
    }

    async _nav(interaction, target) {
        const value = interaction.values?.[0] || target;
        switch (value) {
            case 'levels':  return this._update(interaction, this._levelsScreen(interaction.guild.id));
            case 'roles':   return this._update(interaction, this._rolesScreen(interaction.guild.id));
            case 'users':   return this._update(interaction, this._usersScreen(interaction.guild.id));
            case 'cmds':    return this._update(interaction, this._cmdsScreen(interaction.guild.id));
            case 'sets':    return this._update(interaction, this._setsScreen(interaction.guild.id));
        }
    }

    _levelsScreen(guildId) {
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);

        const embed = new EmbedBuilder()
            .setTitle('👑 Levels')
            .setDescription(
                'Levels are tiers of access with numeric **weights**. Higher weight = more access.\n\n' +
                '• **Default levels** (`member`, `helper`, `moderator`, `admin`) are seeded into ' +
                'every guild on first use, but they\'re yours — rename, reweight, or delete them freely.\n' +
                '• **Custom levels** (e.g. `senior_mod` at weight 7 between `moderator` and `admin`) ' +
                'can be created with any ID and weight.\n' +
                '• Levels alone do nothing — bind Discord roles to them in the **Role bindings** ' +
                'section, or assign individual users via **User overrides**.\n' +
                '• Deleting a level automatically clears any overrides referencing it.'
            )
            .addFields({
                name: 'Current ladder',
                value: ladder.map(l =>
                    `**${l.weight}** · \`${l.id}\` — ${l.name}${l.builtin ? ' *(default)*' : ''}\n` +
                    `  ${l.roles.length ? l.roles.map(r => `<@&${r}>`).join(', ') : '_(no roles bound)_'}`
                ).join('\n\n') || '_(no levels)_'
            });

        const components = [];
        if (ladder.length > 0) {
            const editPick = new StringSelectMenuBuilder()
                .setCustomId('perms:level:edit_pick')
                .setPlaceholder('Edit a level…')
                .addOptions(ladder.slice(0, 25).map(l => ({
                    label: `${l.name} (${l.id})`,
                    description: `weight ${l.weight}${l.builtin ? ' • default' : ''}`,
                    value: l.id
                })));
            components.push(new ActionRowBuilder().addComponents(editPick));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:level:create_btn').setStyle(ButtonStyle.Primary).setLabel('Create level').setEmoji('➕'),
            new ButtonBuilder().setCustomId('perms:level:delete_pick').setStyle(ButtonStyle.Danger).setLabel('Delete level').setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Back').setEmoji('⬅️')
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
            if (!id) return this._safeError(interaction, 'Level ID cannot be empty.');
            if (!Number.isFinite(weight)) return this._safeError(interaction, 'Weight must be an integer.');
            this.client.permissions.setLevel(guildId, { id, name, weight, roles: [] });
            return this._update(interaction, this._levelsScreen(guildId));
        }
        if (action === 'edit_modal') {
            const levelId = rest[0];
            const name = interaction.fields.getTextInputValue('name').slice(0, 64);
            const weight = parseInt(interaction.fields.getTextInputValue('weight'), 10);
            if (!Number.isFinite(weight)) return this._safeError(interaction, 'Weight must be an integer.');
            this.client.permissions.setLevel(guildId, { id: levelId, name, weight });
            return this._update(interaction, this._levelsScreen(guildId));
        }
        if (action === 'delete_pick') {
            const cfg = this.client.permissions.getConfig(guildId);
            const candidates = [...cfg.levels].sort((a, b) => a.weight - b.weight);
            if (candidates.length === 0)
                return this._safeError(interaction, 'No levels to delete.');

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Delete level')
                .setDescription('Pick a level to delete. Any overrides referencing it will be cleared automatically.');
            const select = new StringSelectMenuBuilder()
                .setCustomId('perms:level:delete_confirm')
                .setPlaceholder('Pick a level to delete…')
                .addOptions(candidates.slice(0, 25).map(l => ({
                    label: `${l.name} (${l.id})`,
                    description: `weight ${l.weight}${l.builtin ? ' • default' : ''}`,
                    value: l.id
                })));
            const back = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('perms:nav:levels').setStyle(ButtonStyle.Secondary).setLabel('Cancel').setEmoji('⬅️')
            );
            return this._update(interaction, { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), back] });
        }
        if (action === 'delete_confirm') {
            const levelId = interaction.values[0];
            this.client.permissions.deleteLevel(guildId, levelId);
            return this._update(interaction, this._levelsScreen(guildId));
        }
    }

    async _showLevelModal(interaction, levelId) {
        const isEdit = !!levelId;
        const existing = isEdit ? this.client.permissions.getLevel(interaction.guild.id, levelId) : null;
        if (isEdit && !existing) return this._safeError(interaction, `Unknown level "${levelId}".`);

        const modal = new ModalBuilder()
            .setCustomId(isEdit ? `perms:level:edit_modal:${levelId}` : 'perms:level:create_modal')
            .setTitle(isEdit ? `Edit ${existing.name}` : 'Create a level');

        const inputs = [];
        if (!isEdit) {
            inputs.push(new TextInputBuilder()
                .setCustomId('id').setLabel('Level ID (lowercase, no spaces)')
                .setPlaceholder('senior_mod').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32));
        }
        inputs.push(new TextInputBuilder()
            .setCustomId('name').setLabel('Display name')
            .setPlaceholder('Senior Moderator').setStyle(TextInputStyle.Short)
            .setRequired(true).setMaxLength(64).setValue(existing?.name || ''));
        inputs.push(new TextInputBuilder()
            .setCustomId('weight').setLabel('Weight (higher = more access)')
            .setPlaceholder('7').setStyle(TextInputStyle.Short)
            .setRequired(true).setMaxLength(6).setValue(existing ? String(existing.weight) : ''));

        modal.addComponents(...inputs.map(i => new ActionRowBuilder().addComponents(i)));
        await interaction.showModal(modal);
    }

    _rolesScreen(guildId, focusedLevelId = null) {
        const cfg = this.client.permissions.getConfig(guildId);
        const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
        const focused = focusedLevelId ? ladder.find(l => l.id === focusedLevelId) : null;

        const embed = new EmbedBuilder().setTitle('👥 Role bindings');
        const intro =
            'Bind Discord roles to levels. A member\'s **effective level** is the **highest weight** ' +
            'across every level any of their roles is bound to.\n\n' +
            '• A role may be bound to multiple levels — the resolver picks the strongest.\n' +
            '• Removing a role from a level only changes this binding; the Discord role itself is untouched.\n' +
            '• To force a specific user to a level regardless of their roles, use **User overrides**.';

        if (focused) {
            embed.setDescription(
                intro + '\n\n' +
                `**Selected:** \`${focused.id}\` — ${focused.name} (weight ${focused.weight})\n` +
                (focused.roles.length ? `Bound: ${focused.roles.map(r => `<@&${r}>`).join(', ')}` : '_(no roles bound yet)_')
            );
        } else {
            embed.setDescription(intro);
            embed.addFields({
                name: 'All levels',
                value: ladder.map(l =>
                    `\`${l.id}\` — ${l.roles.length ? l.roles.map(r => `<@&${r}>`).join(', ') : '_none_'}`
                ).join('\n') || '_(no levels)_'
            });
        }

        const components = [];

        if (focused) {
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`perms:role:bind:${focused.id}`)
                    .setPlaceholder(`Bind a role to ${focused.name}…`)
                    .setMinValues(1).setMaxValues(1)
            ));
            if (focused.roles.length > 0) {
                const unbind = new StringSelectMenuBuilder()
                    .setCustomId(`perms:role:unbind:${focused.id}`)
                    .setPlaceholder(`Unbind a role from ${focused.name}…`)
                    .addOptions(focused.roles.slice(0, 25).map(roleId => {
                        const role = this.client.guilds.cache.get(guildId)?.roles?.cache?.get(roleId);
                        return { label: role?.name || roleId, description: roleId, value: roleId };
                    }));
                components.push(new ActionRowBuilder().addComponents(unbind));
            }
        }

        const levelPick = new StringSelectMenuBuilder()
            .setCustomId('perms:role:level_pick')
            .setPlaceholder(focused ? 'Switch to a different level…' : 'Choose a level to manage…')
            .addOptions(ladder.slice(0, 25).map(l => ({
                label: `${l.name} (${l.id})`,
                description: `${l.roles.length} role(s) • weight ${l.weight}`,
                value: l.id
            })));
        components.push(new ActionRowBuilder().addComponents(levelPick));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Back').setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    async _role(interaction, args) {
        const [action, levelId] = args;
        const guildId = interaction.guild.id;

        if (action === 'level_pick') {
            return this._update(interaction, this._rolesScreen(guildId, interaction.values[0]));
        }
        if (action === 'bind') {
            const roleId = interaction.values[0];
            this.client.permissions.bindRole(guildId, levelId, roleId);
            return this._update(interaction, this._rolesScreen(guildId, levelId));
        }
        if (action === 'unbind') {
            const roleId = interaction.values[0];
            this.client.permissions.unbindRole(guildId, levelId, roleId);
            return this._update(interaction, this._rolesScreen(guildId, levelId));
        }
    }

    _usersScreen(guildId, focusedUserId = null) {
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.userOverrides);
        const focused = focusedUserId;

        const embed = new EmbedBuilder()
            .setTitle('👤 User overrides')
            .setDescription(
                'Force a specific level on an individual user, **bypassing role bindings**. ' +
                'When set, the user\'s effective level becomes the override regardless of which ' +
                'roles they have.\n\n' +
                '• Useful for: testing, granting access to someone without giving them a role, ' +
                'or temporarily downgrading a user.\n' +
                '• Clear an override to fall back to normal role-based resolution.'
            );

        embed.addFields({
            name: 'Active overrides',
            value: entries.length
                ? entries.map(([uid, lid]) => `<@${uid}> → \`${lid}\``).join('\n')
                : '_(none)_'
        });

        if (focused) {
            const current = cfg.userOverrides[focused];
            embed.addFields({ name: 'Selected user', value: `<@${focused}>${current ? ` (currently \`${current}\`)` : ' *(no override yet)*'}`, inline: false });
        }

        const components = [];

        components.push(new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('perms:user:pick')
                .setPlaceholder('Pick a user to set/clear an override…')
                .setMinValues(1).setMaxValues(1)
        ));

        if (focused) {
            const ladder = [...cfg.levels].sort((a, b) => a.weight - b.weight);
            const opts = [
                { label: '— Clear override —', value: '__clear__', description: 'Remove this user\'s override.' },
                ...ladder.slice(0, 24).map(l => ({
                    label: `${l.name} (${l.id})`, description: `weight ${l.weight}`, value: l.id
                }))
            ];
            const setSel = new StringSelectMenuBuilder()
                .setCustomId(`perms:user:set:${focused}`)
                .setPlaceholder('Assign a level (or clear)…')
                .addOptions(opts);
            components.push(new ActionRowBuilder().addComponents(setSel));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Back').setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    async _user(interaction, args) {
        const [action, userId] = args;
        const guildId = interaction.guild.id;

        if (action === 'pick') {
            return this._update(interaction, this._usersScreen(guildId, interaction.values[0]));
        }
        if (action === 'set') {
            const value = interaction.values[0];
            this.client.permissions.setUserOverride(guildId, userId, value === '__clear__' ? null : value);
            return this._update(interaction, this._usersScreen(guildId));
        }
    }

    _cmdsScreen(guildId) {
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.commandOverrides);

        const embed = new EmbedBuilder()
            .setTitle('⚡ Command overrides')
            .setDescription(
                'By default, slash commands are gated only by Discord\'s native ' +
                '`defaultMemberPermissions` (visible in **Server Settings → Integrations → ' +
                'this bot**). This screen lets you add an additional **level requirement** ' +
                'on top, in this guild only.\n\n' +
                '• Example: gate `/kick` behind `moderator` — anyone with a role bound to ' +
                '`moderator` (or higher) can use it.\n' +
                '• Set with the **Set override** button (command name + level ID).\n' +
                '• Clear an override to revert to Discord-native default.\n' +
                '• Discord `Administrator`, the guild owner, and the bot OWNER always bypass overrides.'
            )
            .addFields({
                name: 'Active overrides',
                value: entries.length
                    ? entries.map(([c, l]) => `\`/${c}\` → \`${l}\``).join('\n')
                    : '_(none)_'
            });

        const components = [];
        const buttons = [
            new ButtonBuilder().setCustomId('perms:cmd:set_btn').setStyle(ButtonStyle.Primary).setLabel('Set override').setEmoji('➕')
        ];
        if (entries.length > 0) {
            const clear = new StringSelectMenuBuilder()
                .setCustomId('perms:cmd:clear_pick')
                .setPlaceholder('Clear an override…')
                .addOptions(entries.slice(0, 25).map(([c, l]) => ({
                    label: `/${c}`, description: `currently \`${l}\``, value: c
                })));
            components.push(new ActionRowBuilder().addComponents(clear));
        }
        buttons.push(new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Back').setEmoji('⬅️'));
        components.push(new ActionRowBuilder().addComponents(...buttons));
        return { embeds: [embed], components };
    }

    async _cmd(interaction, args) {
        const [action] = args;
        const guildId = interaction.guild.id;

        if (action === 'set_btn') {
            const modal = new ModalBuilder()
                .setCustomId('perms:cmd:set_modal')
                .setTitle('Set command override');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('command').setLabel('Command name (without /)')
                        .setPlaceholder('kick').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('level').setLabel('Level ID')
                        .setPlaceholder('moderator').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                )
            );
            return interaction.showModal(modal);
        }
        if (action === 'set_modal') {
            const cmd = interaction.fields.getTextInputValue('command').replace(/^\//, '').trim();
            const level = interaction.fields.getTextInputValue('level').trim();
            this.client.permissions.setCommandOverride(guildId, cmd, level);
            return this._update(interaction, this._cmdsScreen(guildId));
        }
        if (action === 'clear_pick') {
            const cmd = interaction.values[0];
            this.client.permissions.setCommandOverride(guildId, cmd, null);
            return this._update(interaction, this._cmdsScreen(guildId));
        }
    }

    _setsScreen(guildId) {
        const cfg = this.client.permissions.getConfig(guildId);
        const entries = Object.entries(cfg.settingOverrides);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Setting overrides')
            .setDescription(
                'Re-gate individual settings by their `Module.key` path. By default, anyone ' +
                'who can run `/settings` can edit any key — set an override here to require a ' +
                'specific level for one particular key in this guild.\n\n' +
                '• Example: `Utility.defaultServerLanguage` → `admin` so only admins change ' +
                'the server\'s fallback language, even if mods can otherwise use `/settings`.\n' +
                '• Use **Set override** with a `Module.key` path (autocomplete in `/settings` ' +
                'shows the available keys per module).\n' +
                '• Clear an override to revert to the default `/settings` gate.'
            )
            .addFields({
                name: 'Active overrides',
                value: entries.length
                    ? entries.map(([k, l]) => `\`${k}\` → \`${l}\``).join('\n')
                    : '_(none)_'
            });

        const components = [];
        const buttons = [
            new ButtonBuilder().setCustomId('perms:set:set_btn').setStyle(ButtonStyle.Primary).setLabel('Set override').setEmoji('➕')
        ];
        if (entries.length > 0) {
            const clear = new StringSelectMenuBuilder()
                .setCustomId('perms:set:clear_pick')
                .setPlaceholder('Clear an override…')
                .addOptions(entries.slice(0, 25).map(([k, l]) => ({
                    label: k, description: `currently \`${l}\``, value: k
                })));
            components.push(new ActionRowBuilder().addComponents(clear));
        }
        buttons.push(new ButtonBuilder().setCustomId('perms:home').setStyle(ButtonStyle.Secondary).setLabel('Back').setEmoji('⬅️'));
        components.push(new ActionRowBuilder().addComponents(...buttons));
        return { embeds: [embed], components };
    }

    async _set(interaction, args) {
        const [action] = args;
        const guildId = interaction.guild.id;

        if (action === 'set_btn') {
            const modal = new ModalBuilder()
                .setCustomId('perms:set:set_modal')
                .setTitle('Set setting override');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('key').setLabel('Setting key (Module.key)')
                        .setPlaceholder('Utility.defaultServerLanguage').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('level').setLabel('Level ID')
                        .setPlaceholder('moderator').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
                )
            );
            return interaction.showModal(modal);
        }
        if (action === 'set_modal') {
            const key = interaction.fields.getTextInputValue('key').trim();
            const level = interaction.fields.getTextInputValue('level').trim();
            this.client.permissions.setSettingOverride(guildId, key, level);
            return this._update(interaction, this._setsScreen(guildId));
        }
        if (action === 'clear_pick') {
            const key = interaction.values[0];
            this.client.permissions.setSettingOverride(guildId, key, null);
            return this._update(interaction, this._setsScreen(guildId));
        }
    }

    /**
     * `interaction.update()` works on component AND modal-submit interactions
     * (since modals here are always launched from a panel button/select).
     */
    async _update(interaction, payload) {
        if (interaction.replied || interaction.deferred)
            return interaction.editReply(payload);
        return interaction.update(payload);
    }

    async _safeError(interaction, message) {
        const payload = { content: `:x: ${message}`, embeds: [], components: [], flags: MessageFlags.Ephemeral };
        try {
            if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
            if (interaction.isModalSubmit?.()) return interaction.reply(payload);
            return interaction.reply(payload);
        } catch { /* swallow */ }
    }
};
