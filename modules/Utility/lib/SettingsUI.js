const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');
const { safeUpdate, safeError, truncate, errorPanel } = require('@core/lib/InteractionHelpers.js');

/**
 * In-Discord GUI for per-guild settings.
 *
 *   home  → list of modules with settings
 *   mod   → keys in a module with current values
 *   key   → key detail with type-aware editor
 *
 * Custom-id convention: `settings:<screen>[:<arg>...]`. All user-facing
 * strings flow through the locale system — see
 * modules/Utility/locales/<lang>.yaml under `commands.settings.ui.*`.
 */
module.exports = class SettingsUI {
    /**
     * @param {import('../Utility.js')} utilityModule
     */
    constructor(utilityModule) {
        this.module = utilityModule;
        this.client = utilityModule.client;
    }

    /** Localize a UI string under `commands.settings.ui.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.settings.ui.${key}`, interaction, vars);
    }

    async open(interaction) {
        await interaction.reply({ ...this._home(interaction), flags: MessageFlags.Ephemeral });
    }

    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async handle(interaction) {
        const id = interaction.customId;
        if (!id?.startsWith('settings:')) return false;
        const [, screen, ...args] = id.split(':');

        try {
            switch (screen) {
                case 'home':         return safeUpdate(interaction, this._home(interaction));
                case 'close':        return interaction.update({ content: this._t('errors.closed', interaction), embeds: [], components: [] });
                case 'mod_pick':     return safeUpdate(interaction, this._moduleScreen(interaction, interaction.values[0]));
                case 'mod':          return safeUpdate(interaction, this._moduleScreen(interaction, args[0]));
                case 'key_pick':     return safeUpdate(interaction, this._keyScreen(interaction, args[0], interaction.values[0]));
                case 'key':          return safeUpdate(interaction, this._keyScreen(interaction, args[0], args[1]));
                case 'edit_btn':     return this._showEditModal(interaction, args[0], args[1]);
                case 'edit_modal':   return this._submitSet(interaction, args[0], args[1], interaction.fields.getTextInputValue('value'));
                case 'bool':         return this._submitSet(interaction, args[0], args[1], args[2] === 'true');
                case 'enum_set':     return this._submitSet(interaction, args[0], args[1], interaction.values[0]);
                case 'channel_set':  return this._submitSet(interaction, args[0], args[1], interaction.values[0]);
                case 'role_set':     return this._submitSet(interaction, args[0], args[1], interaction.values[0]);
                case 'user_set':     return this._submitSet(interaction, args[0], args[1], interaction.values[0]);
                case 'arr_add_btn':  return this._showArrayAddModal(interaction, args[0], args[1]);
                case 'arr_add_modal':return this._submitAdd(interaction, args[0], args[1], interaction.fields.getTextInputValue('value'));
                case 'arr_add_sel':  return this._submitAdd(interaction, args[0], args[1], interaction.values[0]);
                case 'arr_remove':   return this._submitRemove(interaction, args[0], args[1], interaction.values[0]);
                case 'reset':        return this._submitReset(interaction, args[0], args[1]);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'SettingsUI', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    _home(interaction) {
        const guildId = interaction.guild.id;
        const modules = [...this.client.settings.entries()];
        const cfg = this.client.permissions.getConfig(guildId);

        const lines = modules.map(([name, mgr]) => {
            const keyCount = mgr.keys().length;
            const overrideCount = Object.keys(cfg.settingOverrides).filter(k => k.startsWith(name + '.')).length;
            const keyText = this._t('home.keys-suffix', interaction, { count: keyCount });
            const overrideText = overrideCount ? ` · ${this._t('home.overrides-suffix', interaction, { count: overrideCount })}` : '';
            return `**${name}** — ${keyText}${overrideText}`;
        });

        const embed = new EmbedBuilder()
            .setTitle(this._t('home.title', interaction))
            .setDescription(this._t('home.description', interaction))
            .addFields({ name: this._t('home.modules-with-settings', interaction), value: lines.join('\n') || this._t('home.none', interaction) });

        const components = [];
        if (modules.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('settings:mod_pick')
                    .setPlaceholder(this._t('home.pick-placeholder', interaction))
                    .addOptions(modules.slice(0, 25).map(([name, mgr]) => ({
                        label: name,
                        description: this._t('home.keys-suffix', interaction, { count: mgr.keys().length }),
                        value: name
                    })))
            ));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('settings:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('settings:close').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.close', interaction)).setEmoji('❌')
        ));

        return { content: '', embeds: [embed], components };
    }

    _moduleScreen(interaction, moduleName) {
        const guildId = interaction.guild.id;
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) return this._errorPanel(interaction, this._t('module.no-settings', interaction, { name: moduleName }));

        const schema = mgr.schema;
        const record = mgr.get(guildId);
        const keys = Object.keys(schema);

        const lines = keys.map(k => {
            const v = record.settings[k];
            return `\`${k}\` — \`${schema[k].type}\` = ${this._format(interaction, v)}`;
        });

        const embed = new EmbedBuilder()
            .setTitle(this._t('module.title', interaction, { name: moduleName }))
            .setDescription(this._t('module.description', interaction))
            .addFields({ name: this._t('module.keys', interaction), value: lines.join('\n') || this._t('module.no-keys', interaction) });

        const components = [];
        if (keys.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`settings:key_pick:${moduleName}`)
                    .setPlaceholder(this._t('module.pick-placeholder', interaction))
                    .addOptions(keys.slice(0, 25).map(k => ({
                        label: k,
                        description: truncate(schema[k].description || schema[k].type, 100),
                        value: k
                    })))
            ));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('settings:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));

        return { embeds: [embed], components };
    }

    _keyScreen(interaction, moduleName, key) {
        const guildId = interaction.guild.id;
        const mgr = this.client.settings.get(moduleName);
        if (!mgr || !mgr.has(key)) return this._errorPanel(interaction, this._t('key.unknown', interaction, { module: moduleName, key }));

        const def = mgr.schema[key];
        const value = mgr.getKey(guildId, key);
        const cfg = this.client.permissions.getConfig(guildId);
        const overrideKey = `${moduleName}.${key}`;
        const override = cfg.settingOverrides[overrideKey];

        const embed = new EmbedBuilder()
            .setTitle(this._t('key.title', interaction, { module: moduleName, key }))
            .setDescription(def.description || this._t('key.no-description', interaction))
            .addFields(
                { name: this._t('key.type', interaction),    value: `\`${def.type}\``, inline: true },
                { name: this._t('key.default', interaction), value: this._format(interaction, def.default), inline: true },
                { name: this._t('key.current', interaction), value: this._format(interaction, value), inline: true }
            );
        if (override) {
            embed.addFields({
                name: this._t('key.permission-override', interaction),
                value: this._t('key.permission-override-value', interaction, { level: override }),
                inline: false
            });
        }

        const components = [
            ...this._editorComponents(interaction, moduleName, key, def, value),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`settings:reset:${moduleName}:${key}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.reset', interaction)).setEmoji('↩️'),
                new ButtonBuilder().setCustomId(`settings:mod:${moduleName}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
            )
        ];
        return { embeds: [embed], components };
    }

    /** Type-driven editor row(s). */
    _editorComponents(interaction, moduleName, key, def, value) {
        const type = def.type;

        const arrMatch = String(type).match(/^array<(.+)>$/);
        if (arrMatch) return this._arrayEditor(interaction, moduleName, key, arrMatch[1], value);

        if (String(type).startsWith('enum:')) {
            const choices = String(type).slice(5).split('|');
            return [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`settings:enum_set:${moduleName}:${key}`)
                    .setPlaceholder(this._t('editors.enum-placeholder', interaction))
                    .addOptions(choices.slice(0, 25).map(c => ({ label: c, value: c, default: c === value })))
            )];
        }

        if (type === 'boolean') {
            return [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`settings:bool:${moduleName}:${key}:true`).setStyle(value === true ? ButtonStyle.Success : ButtonStyle.Secondary).setLabel(this._t('editors.bool-true', interaction)),
                new ButtonBuilder().setCustomId(`settings:bool:${moduleName}:${key}:false`).setStyle(value === false ? ButtonStyle.Danger : ButtonStyle.Secondary).setLabel(this._t('editors.bool-false', interaction))
            )];
        }

        if (type === 'channel') return [new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder().setCustomId(`settings:channel_set:${moduleName}:${key}`)
                .setPlaceholder(this._t('editors.channel-placeholder', interaction)).setMinValues(1).setMaxValues(1)
        )];
        if (type === 'role') return [new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId(`settings:role_set:${moduleName}:${key}`)
                .setPlaceholder(this._t('editors.role-placeholder', interaction)).setMinValues(1).setMaxValues(1)
        )];
        if (type === 'user') return [new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`settings:user_set:${moduleName}:${key}`)
                .setPlaceholder(this._t('editors.user-placeholder', interaction)).setMinValues(1).setMaxValues(1)
        )];

        // Text-based scalars (string / number / integer / snowflake) → modal.
        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settings:edit_btn:${moduleName}:${key}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(this._t('editors.edit-button', interaction))
                .setEmoji('✏️')
        )];
    }

    _arrayEditor(interaction, moduleName, key, innerType, value) {
        const components = [];
        const arr = Array.isArray(value) ? value : [];

        if (innerType === 'channel') {
            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId(`settings:arr_add_sel:${moduleName}:${key}`)
                    .setPlaceholder(this._t('editors.array-add-channel', interaction)).setMinValues(1).setMaxValues(1)
            ));
        } else if (innerType === 'role') {
            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`settings:arr_add_sel:${moduleName}:${key}`)
                    .setPlaceholder(this._t('editors.array-add-role', interaction)).setMinValues(1).setMaxValues(1)
            ));
        } else if (innerType === 'user') {
            components.push(new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder().setCustomId(`settings:arr_add_sel:${moduleName}:${key}`)
                    .setPlaceholder(this._t('editors.array-add-user', interaction)).setMinValues(1).setMaxValues(1)
            ));
        } else {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`settings:arr_add_btn:${moduleName}:${key}`)
                    .setStyle(ButtonStyle.Primary).setLabel(this._t('editors.array-add-button', interaction)).setEmoji('➕')
            ));
        }

        if (arr.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`settings:arr_remove:${moduleName}:${key}`)
                    .setPlaceholder(this._t('editors.array-remove', interaction))
                    .addOptions(arr.slice(0, 25).map(v => ({
                        label: truncate(String(v), 100),
                        value: String(v)
                    })))
            ));
        }
        return components;
    }

    async _showEditModal(interaction, moduleName, key) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr || !mgr.has(key)) return safeError(interaction, this._t('errors.unknown-setting', interaction));
        const def = mgr.schema[key];
        const current = mgr.getKey(interaction.guild.id, key);

        const modal = new ModalBuilder()
            .setCustomId(`settings:edit_modal:${moduleName}:${key}`)
            .setTitle(this._t('modals.edit-title', interaction, { key: truncate(key, 40) }));
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('value')
                .setLabel(this._t('modals.edit-label', interaction, { type: truncate(def.type, 40) }))
                .setStyle(def.type === 'string' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2000)
                .setValue(current == null ? '' : String(current))
        ));
        await interaction.showModal(modal);
    }

    async _showArrayAddModal(interaction, moduleName, key) {
        const modal = new ModalBuilder()
            .setCustomId(`settings:arr_add_modal:${moduleName}:${key}`)
            .setTitle(this._t('modals.array-add-title', interaction, { key: truncate(key, 40) }));
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('value').setLabel(this._t('modals.array-add-label', interaction))
                .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2000)
        ));
        await interaction.showModal(modal);
    }

    async _submitSet(interaction, moduleName, key, value) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) return safeError(interaction, this._t('errors.no-settings-module', interaction, { module: moduleName }));
        try {
            mgr.set(interaction.guild.id, key, value, { actor: interaction.member });
        } catch (err) {
            return safeError(interaction, err.message);
        }
        return safeUpdate(interaction, this._keyScreen(interaction, moduleName, key));
    }

    async _submitAdd(interaction, moduleName, key, value) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) return safeError(interaction, this._t('errors.no-settings-module', interaction, { module: moduleName }));
        try {
            mgr.add(interaction.guild.id, key, value, { actor: interaction.member });
        } catch (err) {
            return safeError(interaction, err.message);
        }
        return safeUpdate(interaction, this._keyScreen(interaction, moduleName, key));
    }

    async _submitRemove(interaction, moduleName, key, value) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) return safeError(interaction, this._t('errors.no-settings-module', interaction, { module: moduleName }));
        try {
            mgr.remove(interaction.guild.id, key, value, { actor: interaction.member });
        } catch (err) {
            return safeError(interaction, err.message);
        }
        return safeUpdate(interaction, this._keyScreen(interaction, moduleName, key));
    }

    async _submitReset(interaction, moduleName, key) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) return safeError(interaction, this._t('errors.no-settings-module', interaction, { module: moduleName }));
        try {
            mgr.reset(interaction.guild.id, key, { actor: interaction.member });
        } catch (err) {
            return safeError(interaction, err.message);
        }
        return safeUpdate(interaction, this._keyScreen(interaction, moduleName, key));
    }

    _format(interaction, v) {
        if (v == null || v === '') return this._t('values.unset', interaction);
        if (Array.isArray(v)) return v.length ? v.map(x => `\`${x}\``).join(', ') : this._t('values.empty', interaction);
        if (typeof v === 'boolean') return v ? '`true`' : '`false`';
        return `\`${truncate(String(v), 200)}\``;
    }

    _errorPanel(interaction, message) {
        return errorPanel({
            message,
            title: this._t('home.title', interaction),
            homeId: 'settings:home',
            backLabel: this._t('buttons.back', interaction)
        });
    }
};
