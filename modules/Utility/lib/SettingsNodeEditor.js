const {
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, MessageFlags
} = require('discord.js');
const { safeUpdate, safeError, truncate, escapeMarkdown, errorContainer, paginate, navRow } = require('@structures/lib/InteractionHelpers.js');

/** Accent bar colour, matching the rest of the settings GUI (Discord blurple). */
const ACCENT = 0x5865F2;
/**
 * Per-page caps — kept small so a screen stays under the v2 40-component cap
 * (every nested button/separator counts). A list item is the heaviest row:
 * a TextDisplay + an ActionRow of up to 4 buttons (= 6 components), so 4 items
 * (≈38 components with the header, nav, add and reset/confirm rows) is the
 * safe ceiling; an object field is just a Section + button (= 3).
 */
const FIELDS_PER_PAGE = 6;   // object screen: one Section per field
const ITEMS_PER_PAGE = 4;    // list screen: a TextDisplay + an ActionRow per item

/** A def may be authored as a bare type string or a full object. */
const normDef = (d) => (typeof d === 'string' ? { type: d } : (d || {}));

/**
 * Drill-down editor for **structural** settings (nested `object`s and `list`s,
 * SETTINGS_NESTED.md). A sibling of {@link CommandPermissionsView}: SettingsUI
 * owns the module/home screens and the flat-key modal, and delegates every
 * `settings:node`/`settings:n*` interaction here.
 *
 * Two screen kinds, which nest in any combination as you drill (an OBJECT screen
 * may open LIST *or* OBJECT screens; a LIST opens OBJECT screens — §2/§8):
 *
 *   OBJECT screen — a fixed set of fields. Scalars/enums/`array<scalar>` get an
 *                   inline ✏️ Edit (the same path-aware modal SettingsUI uses for
 *                   flat keys); nested `list`/`object` fields get a ➡️ Open into
 *                   their own screen.
 *   LIST screen   — a variable sequence of items (objects, usually). Each row has
 *                   Open / move / delete; an Add button appends an item from its
 *                   item-def defaults. Paginated; deletes use a one-step confirm.
 *
 * Custom-id scheme (all under the `settings:` prefix, routed by SettingsUI):
 *   settings:node:<m>:<k>:<path>:<page>       render OBJECT/LIST screen at path
 *   settings:nedit:<m>:<k>:<path>:<page>      open the leaf modal (page = parent to return to)
 *   settings:nsub:<m>:<k>:<path>:<page>       leaf modal submit
 *   settings:nadd:<m>:<k>:<path>              append an item to the list at path
 *   settings:ndel:<m>:<k>:<path>:<index>      arm delete (flips that row to Confirm)
 *   settings:ndelc:<m>:<k>:<path>:<index>     confirm delete
 *   settings:nmove:<m>:<k>:<path>:<index.dir> move item (dir −1 up / +1 down)
 *   settings:nreset:<m>:<k>:<path>:<page>     arm "reset node to default"
 *   settings:nresetc:<m>:<k>:<path>:<page>    confirm reset
 *
 * A `path` is the location inside a top-level key: dot-joined segments, each a
 * field name (object) or an index (list). The key's own value (root) encodes
 * as `-`. Field names/keys may not contain `:` or `.` (reserved here); this is
 * enforced by SettingsManager at schema-build time.
 */
module.exports = class SettingsNodeEditor {
    /**
     * @param {import('../Utility.js')} utilityModule
     * @param {import('./SettingsUI.js')} ui The owning SettingsUI (reused for the leaf modal + value formatting).
     */
    constructor(utilityModule, ui) {
        this.module = utilityModule;
        this.client = utilityModule.client;
        this.ui = ui;
    }

    /** Localize a UI string under `commands.settings.ui.<key>` (shared namespace with SettingsUI). */
    _t(key, interaction, vars) {
        return this.module.t(`commands.settings.ui.${key}`, interaction, vars);
    }

    /** Parse a custom-id path token (`-` → root) into a segment array. */
    _path(token) { return (!token || token === '-') ? [] : token.split('.'); }

    /** Encode a segment array back to a path token (root → `-`). */
    _enc(path) { return path.length ? path.join('.') : '-'; }

    /**
     * Routed from `SettingsUI.handle` for ids `settings:node`/`settings:n*`.
     * Self-contained try/catch so structural-validation errors (e.g. a list's
     * `maxItems`) surface to the user as an ephemeral error.
     * @param {import('discord.js').Interaction} interaction
     * @param {string} screen
     * @param {string[]} args `[module, key, path, …]`
     */
    async handle(interaction, screen, args) {
        try {
            switch (screen) {
                case 'node':    return await this._renderId(interaction, args);
                case 'nedit':   return await this._editModal(interaction, args);
                case 'nsub':    return await this._submitEdit(interaction, args);
                case 'nadd':    return await this._add(interaction, args);
                case 'ndel':    return await this._armDelete(interaction, args);
                case 'ndelc':   return await this._doDelete(interaction, args);
                case 'nmove':   return await this._move(interaction, args);
                case 'nreset':  return await this._armReset(interaction, args);
                case 'nresetc': return await this._doReset(interaction, args);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'SettingsNodeEditor', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    /** Resolve the SettingsManager for a module, or throw a localized error. */
    _mgr(moduleName) {
        const mgr = this.client.settings.get(moduleName);
        if (!mgr) throw new Error(this._t('module.unknown', undefined, { name: moduleName }));
        return mgr;
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    /** `settings:node:<m>:<k>:<path>:<page>` → render the screen at path. */
    async _renderId(interaction, [moduleName, key, pathTok, pageTok]) {
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, this._path(pathTok), Number(pageTok) || 0));
    }

    /** Build the payload for the node at `path` (object or list screen). */
    _screen(interaction, moduleName, key, path, page, confirm = null) {
        const mgr = this._mgr(moduleName);
        if (!mgr.has(key)) return this.ui._errorPanel(interaction, this._t('key.unknown', interaction, { module: moduleName, key }));

        const def = mgr.defAt(key, path);
        if (!def || (def.type !== 'object' && def.type !== 'list'))
            return this.ui._errorPanel(interaction, this._t('node.gone', interaction));

        const value = mgr.getPath(interaction.guild.id, key, path);
        if (value === undefined && path.length)
            return this.ui._errorPanel(interaction, this._t('node.gone', interaction));

        return def.type === 'list'
            ? this._listScreen(interaction, moduleName, key, path, def, Array.isArray(value) ? value : [], page, confirm)
            : this._objectScreen(interaction, moduleName, key, path, def, value || {}, page, confirm);
    }

    /** OBJECT screen: each field is a Section with an inline Edit (leaf) or Open (nested list). */
    _objectScreen(interaction, moduleName, key, path, def, value, page, confirm) {
        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${this._breadcrumb(key, path)}\n-# ${this._t('node.object-desc', interaction)}`
        ));
        if (confirm?.type === 'reset')
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${this._t('node.reset-confirm', interaction)}`));
        container.addSeparatorComponents(new SeparatorBuilder());

        const fields = Object.entries(def.fields || {});
        const { pageItems, page: cur, pageCount } = paginate(fields, page, FIELDS_PER_PAGE);
        if (pageCount > 1)
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${this._t('pagination', interaction, { page: cur + 1, pages: pageCount })}`));

        for (const [name, rawFdef] of pageItems) {
            const fdef = normDef(rawFdef);
            const fpath = [...path, name];
            const isList = fdef.type === 'list';
            const isObject = fdef.type === 'object';
            const isStructural = isList || isObject;
            const display = isList
                ? this._t('node.items', interaction, { count: Array.isArray(value[name]) ? value[name].length : 0 })
                : isObject
                    ? this._t('node.fields', interaction, { count: Object.keys(fdef.fields || {}).length })
                    : this.ui._format(interaction, value[name]);

            const accessory = isStructural
                ? new ButtonBuilder().setCustomId(`settings:node:${moduleName}:${key}:${this._enc(fpath)}:0`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.open', interaction)).setEmoji('➡️')
                : new ButtonBuilder().setCustomId(`settings:nedit:${moduleName}:${key}:${this._enc(fpath)}:${cur}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.edit', interaction)).setEmoji('✏️');

            container.addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${name}\` · \`${fdef.type}\`\n${this._t('key.current', interaction)}: ${display}`))
                .setButtonAccessory(accessory));
        }

        const nav = navRow(p => `settings:node:${moduleName}:${key}:${this._enc(path)}:${p}`, cur, pageCount);
        if (nav) container.addActionRowComponents(nav);

        container.addSeparatorComponents(new SeparatorBuilder());
        container.addActionRowComponents(this._bottomRow(interaction, moduleName, key, path, cur, confirm));
        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /** LIST screen: items as label + per-item button row, plus Add / nav / Reset / Back. */
    _listScreen(interaction, moduleName, key, path, def, arr, page, confirm) {
        const itemIsObject = normDef(def.item).type === 'object';
        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${this._breadcrumb(key, path)}\n-# ${this._t('node.items', interaction, { count: arr.length })}`
        ));
        if (confirm?.type === 'reset')
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${this._t('node.reset-confirm', interaction)}`));
        container.addSeparatorComponents(new SeparatorBuilder());

        const enc = this._enc(path);
        if (!arr.length) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(this._t('node.empty', interaction)));
        } else {
            const { pageItems, page: cur, pageCount } = paginate(arr.map((item, i) => [item, i]), page, ITEMS_PER_PAGE);
            if (pageCount > 1)
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${this._t('pagination', interaction, { page: cur + 1, pages: pageCount })}`));

            for (const [item, index] of pageItems) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${this._itemLabel(interaction, def, item, index)}**`));
                container.addActionRowComponents(this._itemRow(interaction, moduleName, key, path, enc, index, arr.length, itemIsObject, cur, confirm));
            }
            const nav = navRow(p => `settings:node:${moduleName}:${key}:${enc}:${p}`, cur, pageCount);
            if (nav) container.addActionRowComponents(nav);
        }

        // Add (disabled once maxItems is reached) + the shared Reset/Back (or reset-confirm) row.
        container.addSeparatorComponents(new SeparatorBuilder());
        const atMax = def.maxItems != null && arr.length >= def.maxItems;
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`settings:nadd:${moduleName}:${key}:${enc}`).setStyle(ButtonStyle.Success).setLabel(this._t('buttons.add', interaction)).setEmoji('➕').setDisabled(atMax)
        ));
        container.addActionRowComponents(this._bottomRow(interaction, moduleName, key, path, page, confirm));
        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /** The bottom button row shared by both screens: [Reset, Back], or [Cancel, Confirm reset] while armed. */
    _bottomRow(interaction, moduleName, key, path, page, confirm) {
        const enc = this._enc(path);
        if (confirm?.type === 'reset') {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`settings:node:${moduleName}:${key}:${enc}:${page}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.cancel', interaction)).setEmoji('↩️'),
                new ButtonBuilder().setCustomId(`settings:nresetc:${moduleName}:${key}:${enc}:${page}`).setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.confirm-reset', interaction)).setEmoji('♻️')
            );
        }
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`settings:nreset:${moduleName}:${key}:${enc}:${page}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.reset', interaction)).setEmoji('♻️'),
            this._backButton(interaction, moduleName, key, path)
        );
    }

    /** The per-item button row: Open/Edit · move up · move down · Delete (or a Cancel/Confirm pair while armed). */
    _itemRow(interaction, moduleName, key, path, enc, index, length, itemIsObject, page, confirm) {
        const itemPath = this._enc([...path, String(index)]);

        if (confirm?.type === 'del' && confirm.index === index) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`settings:node:${moduleName}:${key}:${enc}:${page}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.cancel', interaction)).setEmoji('↩️'),
                new ButtonBuilder().setCustomId(`settings:ndelc:${moduleName}:${key}:${enc}:${index}`).setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.confirm-delete', interaction)).setEmoji('🗑️')
            );
        }

        const open = itemIsObject
            ? new ButtonBuilder().setCustomId(`settings:node:${moduleName}:${key}:${itemPath}:0`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.open', interaction)).setEmoji('➡️')
            : new ButtonBuilder().setCustomId(`settings:nedit:${moduleName}:${key}:${itemPath}:${page}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.edit', interaction)).setEmoji('✏️');

        return new ActionRowBuilder().addComponents(
            open,
            new ButtonBuilder().setCustomId(`settings:nmove:${moduleName}:${key}:${enc}:${index}.-1`).setStyle(ButtonStyle.Secondary).setEmoji('🔼').setDisabled(index <= 0),
            new ButtonBuilder().setCustomId(`settings:nmove:${moduleName}:${key}:${enc}:${index}.1`).setStyle(ButtonStyle.Secondary).setEmoji('🔽').setDisabled(index >= length - 1),
            new ButtonBuilder().setCustomId(`settings:ndel:${moduleName}:${key}:${enc}:${index}`).setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );
    }

    /**
     * Back goes to the parent node (or, at a key's root, the module screen) — and
     * lands on the *page you left*. That page is derivable from the path, so no
     * custom-id needs to carry it: a list item sits on `index/ITEMS_PER_PAGE`, a
     * nested list on its field's `fieldPos/FIELDS_PER_PAGE`, and a top-level key
     * on its `keyPos/KEYS_PER_PAGE` of the module screen.
     */
    _backButton(interaction, moduleName, key, path) {
        let id;
        if (path.length) {
            id = `settings:node:${moduleName}:${key}:${this._enc(path.slice(0, -1))}:${this._parentPage(moduleName, key, path)}`;
        } else {
            const perPage = this.ui.KEYS_PER_PAGE || 6;
            const keyPage = Math.max(0, Math.floor(this._mgr(moduleName).keys().indexOf(key) / perPage));
            id = `settings:mod:${moduleName}:${keyPage}:0`;
        }
        return new ButtonBuilder().setCustomId(id).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️');
    }

    /** The page the parent screen should open on so it shows the node we're leaving. */
    _parentPage(moduleName, key, path) {
        const last = path[path.length - 1];
        // Parent is a list → the page holding this item index.
        if (/^\d+$/.test(last)) return Math.floor(Number(last) / ITEMS_PER_PAGE);
        // Parent is an object → the page holding this field.
        const parentDef = this._mgr(moduleName).defAt(key, path.slice(0, -1));
        const idx = Object.keys(parentDef?.fields || {}).indexOf(last);
        return idx < 0 ? 0 : Math.floor(idx / FIELDS_PER_PAGE);
    }

    /** `## \`key\` › field › #2 › …` breadcrumb from the path (list indices shown 1-based). */
    _breadcrumb(key, path) {
        const parts = [`\`${key}\``];
        for (const seg of path) parts.push(/^\d+$/.test(seg) ? `#${Number(seg) + 1}` : `\`${seg}\``);
        return parts.join(' › ');
    }

    /** A list item's row title: its `label` field (objects) or the value (scalars), else "Item n".
     *  Escaped because it's rendered inside `**…**` — a raw value may contain markdown. */
    _itemLabel(interaction, listDef, item, index) {
        const itemDef = normDef(listDef.item);
        const fallback = this._t('node.item-n', interaction, { n: index + 1 });
        if (itemDef.type === 'object') {
            const raw = listDef.label && item ? item[listDef.label] : null;
            return (raw != null && String(raw).trim() !== '') ? escapeMarkdown(truncate(String(raw), 80)) : fallback;
        }
        return (item == null || item === '') ? fallback : escapeMarkdown(truncate(String(item), 80));
    }

    // ── Leaf editing (reuses SettingsUI's modal field builders, path-aware) ────

    /** `settings:nedit:<m>:<k>:<path>:<page>` → open the leaf modal for the value at path. */
    async _editModal(interaction, [moduleName, key, pathTok, pageTok]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        const def = mgr.defAt(key, path);
        if (!def) return safeError(interaction, this._t('errors.unknown-setting', interaction));

        const value = mgr.getPath(interaction.guild.id, key, path);
        const fieldName = path[path.length - 1] ?? key;
        const modal = new ModalBuilder()
            .setCustomId(`settings:nsub:${moduleName}:${key}:${this._enc(path)}:${Number(pageTok) || 0}`)
            .setTitle(truncate(this._t('modals.edit-title', interaction, { key: fieldName }), 45))
            .addLabelComponents(
                this.ui._valueLabel(interaction, def, value),
                this.ui._resetLabel(interaction)
            );
        await interaction.showModal(modal);
        return true;
    }

    /** `settings:nsub:<m>:<k>:<path>:<page>` → apply the leaf edit, re-render the parent node. */
    async _submitEdit(interaction, [moduleName, key, pathTok, pageTok]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        const def = mgr.defAt(key, path);
        if (!def) return safeError(interaction, this._t('errors.unknown-setting', interaction));

        const reset = interaction.fields.getStringSelectValues('reset')[0];
        if (reset === 'yes') {
            mgr.resetPath(interaction.guild.id, key, path);
        } else {
            const value = this.ui._readModalValue(interaction, def);
            if (value !== this.ui.NO_CHANGE) mgr.setPath(interaction.guild.id, key, path, value);
        }
        const page = Number(pageTok) || 0;
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path.slice(0, -1), page));
    }

    // ── List mutations ────────────────────────────────────────────────────────

    /** `settings:nadd:<m>:<k>:<path>` → append a default item, land on its (last) page. */
    async _add(interaction, [moduleName, key, pathTok]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        mgr.listAdd(interaction.guild.id, key, path);
        const len = (mgr.getPath(interaction.guild.id, key, path) || []).length;
        const lastPage = Math.max(0, Math.ceil(len / ITEMS_PER_PAGE) - 1);
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, lastPage));
    }

    /** `settings:ndel:<m>:<k>:<path>:<index>` → arm the delete (flip that row to Confirm). */
    async _armDelete(interaction, [moduleName, key, pathTok, idxTok]) {
        const path = this._path(pathTok);
        const index = Number(idxTok);
        const page = Math.floor(index / ITEMS_PER_PAGE);
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, page, { type: 'del', index }));
    }

    /** `settings:ndelc:<m>:<k>:<path>:<index>` → confirm the delete, re-render the list. */
    async _doDelete(interaction, [moduleName, key, pathTok, idxTok]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        const index = Number(idxTok);
        mgr.listRemove(interaction.guild.id, key, path, index);
        const len = (mgr.getPath(interaction.guild.id, key, path) || []).length;
        const page = Math.min(Math.floor(index / ITEMS_PER_PAGE), Math.max(0, Math.ceil(len / ITEMS_PER_PAGE) - 1));
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, page));
    }

    /** `settings:nmove:<m>:<k>:<path>:<index.dir>` → reorder one item up/down. */
    async _move(interaction, [moduleName, key, pathTok, idxDir]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        const [idxStr, dirStr] = String(idxDir).split('.');
        const index = Number(idxStr);
        const dir = Number(dirStr);
        mgr.listMove(interaction.guild.id, key, path, index, dir);
        const page = Math.floor(Math.max(0, index + (dir < 0 ? -1 : 0)) / ITEMS_PER_PAGE);
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, page));
    }

    // ── Node reset (object → field defaults, list → empty) ──────────────────────

    /** `settings:nreset:<m>:<k>:<path>:<page>` → arm a node reset (show the confirm bar). */
    async _armReset(interaction, [moduleName, key, pathTok, pageTok]) {
        const path = this._path(pathTok);
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, Number(pageTok) || 0, { type: 'reset' }));
    }

    /** `settings:nresetc:<m>:<k>:<path>:<page>` → confirm the node reset. */
    async _doReset(interaction, [moduleName, key, pathTok, pageTok]) {
        const mgr = this._mgr(moduleName);
        const path = this._path(pathTok);
        mgr.resetPath(interaction.guild.id, key, path);
        return safeUpdate(interaction, this._screen(interaction, moduleName, key, path, Number(pageTok) || 0));
    }
};
