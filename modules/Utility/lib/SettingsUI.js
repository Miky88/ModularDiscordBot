const {
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');
const { safeUpdate, safeError, truncate, escapeMarkdown, errorContainer, paginate, navRow } = require('@structures/lib/InteractionHelpers.js');
const CommandPermissionsView = require('./CommandPermissionsView.js');
const SettingsNodeEditor = require('./SettingsNodeEditor.js');

/** Accent bar colour for the settings containers (Discord blurple). */
const ACCENT = 0x5865F2;
/** Section page sizes — kept modest so a screen stays under the v2 40-component cap. */
const MODULES_PER_PAGE = 8;
const KEYS_PER_PAGE = 6;
/** Sentinel from `_readModalValue`: leave the value unchanged (don't call set). */
const NO_CHANGE = Symbol('no-change');

/**
 * In-Discord GUI for per-guild settings — the single panel behind `/settings`,
 * built with **Components v2** (accent containers, Sections with inline button
 * accessories, inline selects). Every payload carries `MessageFlags.IsComponentsV2`
 * and contains no embeds/content.
 *
 *   home  → modules (with settings and/or commands) as Sections, each with an Open button
 *   mod   → a module's settings keys (Sections + inline Edit) above, command
 *           permissions (read-only) below
 *   edit  → a key's Edit button opens a modal directly (a type-driven value
 *           input + a "Reset to default?" Yes/No select); its submit applies the
 *           change and re-renders the module screen — there is no key screen
 *   cperm → one command's permission detail (read-only; delegated to
 *           CommandPermissionsView), reached from the module screen's command select
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
        this.cmdperms = new CommandPermissionsView(utilityModule);
        this.nodeEditor = new SettingsNodeEditor(utilityModule, this);
        // Re-exported so SettingsNodeEditor can reuse the leaf-modal value reader
        // and compute which module-screen page a key sits on (for its Back button).
        this.NO_CHANGE = NO_CHANGE;
        this.KEYS_PER_PAGE = KEYS_PER_PAGE;
    }

    /** Localize a UI string under `commands.settings.ui.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.settings.ui.${key}`, interaction, vars);
    }

    async open(interaction) {
        await interaction.reply({ ...this._home(interaction), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
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
                case 'home':         return safeUpdate(interaction, this._home(interaction, Number(args[0]) || 0));
                case 'close':        return interaction.update({ components: [new TextDisplayBuilder().setContent(this._t('errors.closed', interaction))], flags: MessageFlags.IsComponentsV2 });
                case 'cperm':        return this.cmdperms.handle(interaction, args);
                case 'mod':          return this._openModule(interaction, args[0], Number(args[1]) || 0, Number(args[2]) || 0);
                // A flat key's Edit button opens the unified editor modal directly
                // (no intermediate screen); its submit applies the change in place.
                case 'edit':         return this._editModal(interaction, args[0], args[1], Number(args[2]) || 0, Number(args[3]) || 0);
                case 'editsub':      return this._submitEdit(interaction, args[0], args[1], Number(args[2]) || 0, Number(args[3]) || 0);
                // Structural keys (object/list) drill into the nested node editor.
                case 'node': case 'nedit': case 'nsub': case 'nadd':
                case 'ndel': case 'ndelc': case 'nmove': case 'nreset': case 'nresetc':
                    return this.nodeEditor.handle(interaction, screen, args);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'SettingsUI', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    _home(interaction, page = 0) {
        const modules = this.client.modules.enabledModules()
            .filter(m => m.settings || m.commands.size > 0)
            .sort((a, b) => a.options.name.localeCompare(b.options.name));

        const summary = (m) => this._t('home.module-summary', interaction, {
            keys: m.settings ? m.settings.keys().length : 0,
            commands: m.commands.size
        });

        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${this._t('home.title', interaction)}\n${this._t('home.description', interaction)}`
        ));
        container.addSeparatorComponents(new SeparatorBuilder());

        if (modules.length > 0) {
            const { pageItems, page: current, pageCount } = paginate(modules, page, MODULES_PER_PAGE);
            for (const m of pageItems) {
                container.addSectionComponents(new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${m.options.name}**\n-# ${summary(m)}`))
                    .setButtonAccessory(new ButtonBuilder().setCustomId(`settings:mod:${m.options.name}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.open', interaction)).setEmoji('➡️')));
            }
            const nav = navRow(p => `settings:home:${p}`, current, pageCount);
            if (nav) {
                container.addActionRowComponents(nav);
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${this._t('pagination', interaction, { page: current + 1, pages: pageCount })}`));
            }
        } else {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(this._t('home.none', interaction)));
        }

        container.addSeparatorComponents(new SeparatorBuilder());
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('settings:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('settings:close').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.close', interaction)).setEmoji('❌')
        ));

        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /** Defer + render the (async, perms-fetching) module screen in place. */
    async _openModule(interaction, moduleName, keyPage, cmdPage) {
        await interaction.deferUpdate();
        return interaction.editReply(await this._moduleScreen(interaction, moduleName, keyPage, cmdPage));
    }

    /**
     * One screen per module: settings keys (above) and that module's native
     * command permissions (below), each independently paginated on its own axis
     * of the screen's custom-id (`settings:mod:<module>:<keyPage>:<cmdPage>`).
     * Async because the command-permissions block reads live from Discord.
     */
    async _moduleScreen(interaction, moduleName, keyPage = 0, cmdPage = 0) {
        const guildId = interaction.guild.id;
        const mod = this.client.modules.getModule(moduleName);
        if (!mod) return this._errorPanel(interaction, this._t('module.unknown', interaction, { name: moduleName }));

        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${this._t('module.title', interaction, { name: moduleName })}\n${this._t('module.description', interaction)}`
        ));

        // Settings keys (above) — Sections with inline Edit buttons.
        container.addSeparatorComponents(new SeparatorBuilder());
        const mgr = mod.settings;
        if (mgr) {
            const schema = mgr.schema;
            const record = mgr.get(guildId);
            const keys = Object.keys(schema);

            if (keys.length > 0) {
                const { pageItems, page, pageCount } = paginate(keys, keyPage, KEYS_PER_PAGE);
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(this._heading(this._t('module.settings-field', interaction), interaction, page, pageCount)));
                for (const k of pageItems) {
                    // Structural keys (object/list) drill into the node editor with an
                    // Open button; flat keys keep the in-place Edit modal.
                    const structural = schema[k].type === 'object' || schema[k].type === 'list';
                    const accessory = structural
                        ? new ButtonBuilder().setCustomId(`settings:node:${moduleName}:${k}:-:0`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.open', interaction)).setEmoji('➡️')
                        : new ButtonBuilder().setCustomId(`settings:edit:${moduleName}:${k}:${page}:${cmdPage}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.edit', interaction)).setEmoji('✏️');
                    container.addSectionComponents(new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${k}\` · \`${schema[k].type}\`\n${this._t('key.current', interaction)}: ${this._summary(interaction, schema[k], record.settings[k])}`))
                        .setButtonAccessory(accessory));
                }
                const nav = navRow(p => `settings:mod:${moduleName}:${p}:${cmdPage}`, page, pageCount);
                if (nav) container.addActionRowComponents(nav);
            } else {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${this._t('module.settings-field', interaction)}\n${this._t('module.no-keys', interaction)}`));
            }
        } else {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${this._t('module.settings-field', interaction)}\n${this._t('module.no-settings', interaction, { name: moduleName })}`));
        }

        // Command permissions (below) — delegated to CommandPermissionsView.
        const cmdButtons = [];
        if (mod.commands.size > 0) {
            container.addSeparatorComponents(new SeparatorBuilder());
            cmdButtons.push(...await this.cmdperms.sectionInto(container, interaction, { moduleName, keyPage, cmdPage }));
        }

        container.addSeparatorComponents(new SeparatorBuilder());
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            ...cmdButtons,
            new ButtonBuilder().setCustomId('settings:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
        ));

        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /** A markdown `##` section heading, with a small "Page x/y" subline when paginated. */
    _heading(label, interaction, page, pageCount) {
        return pageCount > 1 ? `## ${label}\n-# ${this._t('pagination', interaction, { page: page + 1, pages: pageCount })}` : `## ${label}`;
    }

    /**
     * Open the unified editor modal for one key — a single dynamic input chosen
     * by the key's type, plus a "Reset to default?" Yes/No select (default No).
     * No intermediate screen: the modal opens straight from the key's Edit button.
     * `keyPage`/`cmdPage` are threaded through the modal custom-id so the submit
     * can re-render the same module-screen page.
     */
    async _editModal(interaction, moduleName, key, keyPage, cmdPage) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr || !mgr.has(key)) return safeError(interaction, this._t('errors.unknown-setting', interaction));
        const def = mgr.schema[key];
        const value = mgr.getKey(interaction.guild.id, key);

        const modal = new ModalBuilder()
            .setCustomId(`settings:editsub:${moduleName}:${key}:${keyPage}:${cmdPage}`)
            .setTitle(truncate(this._t('modals.edit-title', interaction, { key }), 45))
            .addLabelComponents(
                this._valueLabel(interaction, def, value),
                this._resetLabel(interaction)
            );
        await interaction.showModal(modal);
    }

    /**
     * The dynamic value input, wrapped in a Label, chosen by the key's type:
     * text input for scalars, a string-select for boolean/enum, a native picker
     * for channel/role/user, and (for arrays) a multi-select or a one-per-line
     * paragraph that edits the whole list. Prefilled with the current value.
     */
    _valueLabel(interaction, def, value) {
        const type = String(def.type);
        const label = new LabelBuilder().setLabel(truncate(this._t('modals.edit-label', interaction, { type }), 45));
        if (def.description) label.setDescription(truncate(def.description, 100));

        // Channel/role/user pickers allow an empty selection (minValues 0), so
        // they must be marked optional — Discord rejects required + min_values 0.
        const arr = type.match(/^array<(.+)>$/);
        if (arr) {
            const inner = arr[1];
            if (inner === 'channel') return label.setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(25).setDefaultChannels(...this._ids(value)));
            if (inner === 'role')    return label.setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(25).setDefaultRoles(...this._ids(value)));
            if (inner === 'user')    return label.setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(25).setDefaultUsers(...this._ids(value)));
            label.setDescription(truncate(this._t('modals.array-hint', interaction), 100));
            return label.setTextInputComponent(new TextInputBuilder().setCustomId('value').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000).setValue((Array.isArray(value) ? value : []).join('\n')));
        }

        if (type === 'boolean') return label.setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('value').setMinValues(1).setMaxValues(1).addOptions(
            { label: this._t('editors.bool-true', interaction), value: 'true', default: value === true },
            { label: this._t('editors.bool-false', interaction), value: 'false', default: value === false }
        ));
        if (type.startsWith('enum:')) {
            const choices = type.slice(5).split('|');
            return label.setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('value').setMinValues(1).setMaxValues(1)
                .addOptions(choices.slice(0, 25).map(c => ({ label: c, value: c, default: c === value }))));
        }
        if (type === 'channel') return label.setChannelSelectMenuComponent(new ChannelSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(1).setDefaultChannels(...this._ids(value)));
        if (type === 'role')    return label.setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(1).setDefaultRoles(...this._ids(value)));
        if (type === 'user')    return label.setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('value').setRequired(false).setMinValues(0).setMaxValues(1).setDefaultUsers(...this._ids(value)));

        // Text-based scalars (string / number / integer / snowflake).
        return label.setTextInputComponent(new TextInputBuilder().setCustomId('value')
            .setStyle(type === 'string' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(false).setMaxLength(type === 'string' ? 4000 : 100)
            .setValue(value == null ? '' : String(value)));
    }

    /** The "Reset to default?" Yes/No select (default No), wrapped in a Label. */
    _resetLabel(interaction) {
        return new LabelBuilder()
            .setLabel(truncate(this._t('modals.reset-label', interaction), 45))
            .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('reset').setMinValues(1).setMaxValues(1).addOptions(
                { label: this._t('modals.reset-no', interaction), value: 'no', default: true },
                { label: this._t('modals.reset-yes', interaction), value: 'yes' }
            ));
    }

    /** Snowflake id(s) from a stored value (single or array), for select defaults. */
    _ids(value) {
        if (value == null || value === '') return [];
        return (Array.isArray(value) ? value : [value]).filter(Boolean);
    }

    /**
     * Apply an editor-modal submission: reset to default if "Yes" was picked,
     * otherwise read the type-appropriate value and set it. `NO_CHANGE` (an empty
     * scalar input or untouched-empty single picker) leaves the value as-is —
     * clearing a value is done via Reset. Then re-render the module screen.
     */
    async _submitEdit(interaction, moduleName, key, keyPage, cmdPage) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr || !mgr.has(key)) return safeError(interaction, this._t('key.unknown', interaction, { module: moduleName, key }));

        const reset = interaction.fields.getStringSelectValues('reset')[0];
        try {
            if (reset === 'yes') {
                mgr.reset(interaction.guild.id, key);
            } else {
                const value = this._readModalValue(interaction, mgr.schema[key]);
                if (value !== NO_CHANGE) mgr.set(interaction.guild.id, key, value);
            }
        } catch (err) {
            return safeError(interaction, err.message);
        }
        return this._openModule(interaction, moduleName, keyPage, cmdPage);
    }

    /** Read the modal's `value` component as the typed new value (or `NO_CHANGE`). */
    _readModalValue(interaction, def) {
        const f = interaction.fields;
        const type = String(def.type);

        const arr = type.match(/^array<(.+)>$/);
        if (arr) {
            const inner = arr[1];
            if (inner === 'channel') return [...f.getSelectedChannels('value').keys()];
            if (inner === 'role')    return [...f.getSelectedRoles('value').keys()];
            if (inner === 'user')    return [...f.getSelectedUsers('value').keys()];
            return f.getTextInputValue('value').split(/\r?\n/).map(s => s.trim()).filter(s => s.length);
        }

        if (type === 'boolean')      return f.getStringSelectValues('value')[0] === 'true';
        if (type.startsWith('enum:')) return f.getStringSelectValues('value')[0];
        if (type === 'channel')      return [...f.getSelectedChannels('value').keys()][0] ?? NO_CHANGE;
        if (type === 'role')         return [...f.getSelectedRoles('value').keys()][0] ?? NO_CHANGE;
        if (type === 'user')         return [...f.getSelectedUsers('value').keys()][0] ?? NO_CHANGE;

        const raw = f.getTextInputValue('value');
        if (type !== 'string' && raw.trim() === '') return NO_CHANGE; // clear a scalar via Reset, not an empty field
        return raw;
    }

    _format(interaction, v) {
        if (v == null || v === '') return this._t('values.unset', interaction);
        if (Array.isArray(v)) return v.length ? v.map(x => `\`${x}\``).join(', ') : this._t('values.empty', interaction);
        if (typeof v === 'boolean') return v ? '`true`' : '`false`';
        // Escaped plain text (not a code span): a raw value may itself contain
        // backticks / markdown, which would break an enclosing `` `…` `` span.
        return escapeMarkdown(truncate(String(v), 200));
    }

    /**
     * Module-screen value cell: a one-line summary for structural keys (a list's
     * item count, an object's field count) and the usual `_format` for flat keys.
     */
    _summary(interaction, def, v) {
        if (def.type === 'list') return this._t('node.items', interaction, { count: Array.isArray(v) ? v.length : 0 });
        if (def.type === 'object') return this._t('node.fields', interaction, { count: def.fields ? Object.keys(def.fields).length : 0 });
        return this._format(interaction, v);
    }

    _errorPanel(interaction, message) {
        return errorContainer({
            message,
            backId: 'settings:home',
            backLabel: this._t('buttons.back', interaction)
        });
    }
};
