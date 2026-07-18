const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, LabelBuilder, FileUploadBuilder,
    AttachmentBuilder, MessageFlags
} = require('discord.js');
const { safeUpdate, safeError, truncate, escapeMarkdown, errorContainer } = require('@structures/lib/InteractionHelpers.js');
const pkg = require('../../../package.json');

/** Accent bar colour, matching the rest of the settings GUI (Discord blurple). */
const ACCENT = 0x5865F2;
const OK_GREEN = 0x57F287;
/** Wire format marker + version — bumped only on a breaking file-shape change. */
const FORMAT = 'mdb-settings-export';
const FORMAT_VERSION = 1;
/** Reject oversized uploads before fetching (a settings blob is tiny; this is abuse protection). */
const MAX_BYTES = 256 * 1024;
/** Import previews live in memory only until Apply/Cancel; swept after this (< the 15-min token life). */
const STASH_TTL = 14 * 60 * 1000;
/** Report caps so a preview screen stays well under the v2 40-component / 4000-char limits. */
const MAX_MODULE_BLOCKS = 12;
const MAX_SKIP_PER_MODULE = 6;

/**
 * Import / Export for per-guild settings — the Export and Import buttons on the
 * `/settings` panel. A sibling of {@link SettingsNodeEditor}: SettingsUI owns the
 * home/module screens and routes every `settings:export|import|importsub|ioapply|
 * iocancel` interaction here.
 *
 * **Export** serialises a guild's settings (all modules, or one) to a JSON file
 * attachment. The file is self-describing (bot identity, per-module version, and
 * a per-key type signature) so it survives a move to a different bot.
 *
 * **Import** reads such a file back via a Discord file-upload modal, then
 * *analyses* it against this bot's live schema before writing anything: modules
 * that don't exist here, keys that were removed, keys whose type changed, and
 * values that fail validation are each reported and skipped — the rest are shown
 * in a preview that the admin must confirm. On confirm the import runs in
 * **Replace** mode: for every imported module, keys present in the file are set
 * and the module's other keys are reset to their defaults.
 *
 * Custom-id scheme (all under the `settings:` prefix, routed by SettingsUI):
 *   settings:export[:<module>]     build + send the export file (all / one module)
 *   settings:import[:<module>]     open the file-upload modal
 *   settings:importsub[:<module>]  modal submit → analyse → preview
 *   settings:ioapply:<token>       apply a previewed import
 *   settings:iocancel:<token>      discard a previewed import
 */
module.exports = class SettingsPortability {
    /**
     * @param {import('../Utility.js')} utilityModule
     * @param {import('./SettingsUI.js')} ui The owning SettingsUI (reused for error panels / value formatting).
     */
    constructor(utilityModule, ui) {
        this.module = utilityModule;
        this.client = utilityModule.client;
        this.ui = ui;
        /** token → { data, moduleName, ts } — previewed imports awaiting Apply/Cancel. */
        this._stash = new Map();
    }

    /** Localize a UI string under `commands.settings.ui.io.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.settings.ui.io.${key}`, interaction, vars);
    }

    /**
     * Routed from `SettingsUI.handle` for the `settings:export|import|importsub|
     * ioapply|iocancel` ids. Self-contained try/catch (like SettingsNodeEditor)
     * so any unexpected failure surfaces to the user as an ephemeral error.
     * @param {import('discord.js').Interaction} interaction
     * @param {string} screen
     * @param {string[]} args
     */
    async handle(interaction, screen, args) {
        try {
            switch (screen) {
                case 'export':    return await this.handleExport(interaction, args);
                case 'import':    return await this.openImportModal(interaction, args);
                case 'importsub': return await this.handleImportSubmit(interaction, args);
                case 'ioapply':   return await this.handleApply(interaction, args);
                case 'iocancel':  return await this.handleCancel(interaction, args);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'SettingsPortability', userId: interaction.user?.id });
            await safeError(interaction, err.message);
        }
        return true;
    }

    // ── Export ─────────────────────────────────────────────────────────────────

    /**
     * Build the export object for a guild. `moduleName` limits it to one module;
     * omit for every enabled module that declares settings.
     */
    build(guildId, guild, moduleName) {
        const mods = moduleName
            ? [this.client.modules.getModule(moduleName)].filter(m => m && m.settings)
            : this.client.modules.enabledModules().filter(m => m.settings);

        const modules = {};
        for (const m of mods) {
            const mgr = m.settings;
            const schema = mgr.schema;
            const keys = {};
            for (const k of Object.keys(schema)) keys[k] = { type: schema[k].type };
            modules[m.options.name] = {
                moduleVersion: m.options.version ?? null,
                keys,
                // A deep copy of the stored value tree (get() also backfills defaults).
                settings: JSON.parse(JSON.stringify(mgr.get(guildId).settings))
            };
        }

        return {
            format: FORMAT,
            version: FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            bot: { app: this.client.user?.username ?? null, pkg: pkg.name, botVersion: pkg.version },
            guild: { id: guildId, name: guild?.name ?? null },
            scope: moduleName ? 'module' : 'all',
            modules
        };
    }

    /** Wrap an export object in a downloadable `.json` AttachmentBuilder. */
    attachment(obj, moduleName) {
        const date = new Date().toISOString().slice(0, 10);
        const scope = moduleName ? moduleName : 'all';
        const name = `settings-${obj.guild?.id || 'guild'}-${scope}-${date}.json`;
        return new AttachmentBuilder(Buffer.from(JSON.stringify(obj, null, 2), 'utf8'), { name });
    }

    /** `settings:export[:<module>]` → reply (new ephemeral message) with the export file; panel stays. */
    async handleExport(interaction, [moduleName]) {
        if (moduleName && !this.client.settings.get(moduleName))
            return safeError(interaction, this._t('errors.module-unknown', interaction, { name: moduleName }));

        const obj = this.build(interaction.guild.id, interaction.guild, moduleName);
        if (Object.keys(obj.modules).length === 0)
            return safeError(interaction, this._t('errors.nothing-to-export', interaction));

        await interaction.reply({
            content: this._t('export.ready', interaction, {
                scope: moduleName || this._t('scope.all', interaction),
                count: Object.keys(obj.modules).length
            }),
            files: [this.attachment(obj, moduleName)],
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    // ── Parse / analyse / apply (pure — no Discord, no localization) ────────────

    /** Parse + shape-check a file's text. Returns `{ ok, data }` or `{ ok:false, code }`. */
    parse(text) {
        let data;
        try { data = JSON.parse(text); }
        catch { return { ok: false, code: 'not-json' }; }
        if (!data || typeof data !== 'object' || data.format !== FORMAT || !data.modules || typeof data.modules !== 'object')
            return { ok: false, code: 'wrong-format' };
        if (data.version !== FORMAT_VERSION)
            return { ok: false, code: 'wrong-version', version: data.version };
        return { ok: true, data };
    }

    /**
     * Compare a parsed export against this bot's live schema without writing.
     * Returns a per-module report; `moduleName` restricts it to one module.
     *
     * Per key: unknown here → skip; declared type differs → skip; else dry-run
     * `mgr.validate()` (catches structural/shape drift too) → apply or skip.
     * Replace mode also lists each local key absent from the file as `reset`.
     */
    analyze(data, moduleName) {
        const wanted = moduleName ? [moduleName] : Object.keys(data.modules);
        const modules = [];
        const totals = { apply: 0, reset: 0, skip: 0, modulesMissing: 0 };

        for (const name of wanted) {
            const fileMod = data.modules[name];
            if (!fileMod) continue;

            const mgr = this.client.settings.get(name);
            if (!mgr || !this.client.modules.isEnabled(name)) {
                modules.push({ name, status: 'missing', versionMismatch: null, keys: [], counts: { apply: 0, reset: 0, skip: 0 } });
                totals.modulesMissing++;
                continue;
            }

            const localSchema = mgr.schema;
            const fileSettings = fileMod.settings || {};
            const fileKeys = fileMod.keys || {};
            const keys = [];
            const counts = { apply: 0, reset: 0, skip: 0 };

            for (const [key, value] of Object.entries(fileSettings)) {
                if (!mgr.has(key)) { keys.push({ key, action: 'skip', reason: { code: 'unknown-key' } }); counts.skip++; continue; }
                const fileType = fileKeys[key]?.type;
                const localType = localSchema[key].type;
                if (fileType && fileType !== localType) {
                    keys.push({ key, action: 'skip', reason: { code: 'type-changed', from: fileType, to: localType } });
                    counts.skip++;
                    continue;
                }
                try {
                    keys.push({ key, action: 'apply', value: mgr.validate(key, value) });
                    counts.apply++;
                } catch (e) {
                    keys.push({ key, action: 'skip', reason: { code: 'invalid', error: e.message } });
                    counts.skip++;
                }
            }

            // Replace: every local key not carried by the file is reset to default.
            for (const key of mgr.keys()) {
                if (!(key in fileSettings)) { keys.push({ key, action: 'reset' }); counts.reset++; }
            }

            const fileVer = fileMod.moduleVersion ?? null;
            const localVer = mgr.module.options.version ?? null;
            const versionMismatch = String(fileVer) !== String(localVer) ? { from: fileVer, to: localVer } : null;

            modules.push({ name, status: 'ok', versionMismatch, keys, counts });
            totals.apply += counts.apply;
            totals.reset += counts.reset;
            totals.skip += counts.skip;
        }

        return { modules, totals };
    }

    /** Apply a previously-analysed import (Replace mode). Returns a result summary. */
    apply(guildId, data, moduleName) {
        const report = this.analyze(data, moduleName);
        const results = { apply: 0, reset: 0, skip: report.totals.skip, failed: 0, modulesMissing: report.totals.modulesMissing };

        for (const mod of report.modules) {
            if (mod.status !== 'ok') continue;
            const mgr = this.client.settings.get(mod.name);
            for (const k of mod.keys) {
                try {
                    if (k.action === 'apply') { mgr.set(guildId, k.key, k.value); results.apply++; }
                    else if (k.action === 'reset') { mgr.reset(guildId, k.key); results.reset++; }
                } catch (e) {
                    results.failed++;
                    this.client.errorHandler?.capture(e, { source: 'SettingsPortability.apply', module: mod.name, key: k.key });
                }
            }
        }
        return results;
    }

    // ── Import (interaction flow) ───────────────────────────────────────────────

    /** `settings:import[:<module>]` → open a modal with a single file-upload field. */
    async openImportModal(interaction, [moduleName]) {
        const modal = new ModalBuilder()
            .setCustomId(moduleName ? `settings:importsub:${moduleName}` : 'settings:importsub')
            .setTitle(truncate(moduleName
                ? this._t('import.title-module', interaction, { name: moduleName })
                : this._t('import.title-all', interaction), 45))
            .addLabelComponents(new LabelBuilder()
                .setLabel(truncate(this._t('import.file-label', interaction), 45))
                .setDescription(truncate(this._t('import.file-desc', interaction), 100))
                .setFileUploadComponent(new FileUploadBuilder().setCustomId('file').setRequired(true).setMinValues(1).setMaxValues(1)));
        await interaction.showModal(modal);
        return true;
    }

    /** `settings:importsub[:<module>]` → download + analyse the upload, show the preview. */
    async handleImportSubmit(interaction, [moduleName]) {
        // Defer with the v2 flag so the preview/errors can be Components-v2.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

        const file = interaction.fields.getUploadedFiles('file')?.first();
        if (!file) return interaction.editReply(errorContainer({ message: this._t('errors.no-file', interaction) }));
        if (file.size != null && file.size > MAX_BYTES)
            return interaction.editReply(errorContainer({ message: this._t('errors.too-large', interaction, { max: Math.round(MAX_BYTES / 1024) }) }));

        let text;
        try {
            const res = await fetch(file.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            text = await res.text();
        } catch (e) {
            this.client.errorHandler?.capture(e, { source: 'SettingsPortability.fetch', userId: interaction.user?.id });
            return interaction.editReply(errorContainer({ message: this._t('errors.fetch-failed', interaction) }));
        }

        const parsed = this.parse(text);
        if (!parsed.ok)
            return interaction.editReply(errorContainer({ message: this._t(`errors.${parsed.code}`, interaction, { version: parsed.version }) }));

        const report = this.analyze(parsed.data, moduleName || undefined);

        this._sweep();
        const token = interaction.id;
        this._stash.set(token, { data: parsed.data, moduleName: moduleName || null, ts: Date.now() });

        return interaction.editReply(this._reportPayload(interaction, parsed.data, report, token));
    }

    /** `settings:ioapply:<token>` → apply the stashed import, replace the preview with a summary. */
    async handleApply(interaction, [token]) {
        const entry = token && this._stash.get(token);
        if (!entry) return safeUpdate(interaction, this._doneContainer(this._t('errors.expired', interaction), true));
        this._stash.delete(token);

        const r = this.apply(interaction.guild.id, entry.data, entry.moduleName || undefined);
        return safeUpdate(interaction, this._doneContainer(this._t('apply.summary', interaction, {
            apply: r.apply, reset: r.reset, skip: r.skip, missing: r.modulesMissing
        })));
    }

    /** `settings:iocancel:<token>` → discard the stashed import. */
    async handleCancel(interaction, [token]) {
        if (token) this._stash.delete(token);
        return safeUpdate(interaction, this._doneContainer(this._t('import.cancelled', interaction)));
    }

    /** Drop preview stashes older than the token lifetime. */
    _sweep() {
        const now = Date.now();
        for (const [k, v] of this._stash) if (now - v.ts > STASH_TTL) this._stash.delete(k);
    }

    // ── Rendering ───────────────────────────────────────────────────────────────

    /** The import preview: per-module status + skipped-key reasons, and an Apply/Cancel row. */
    _reportPayload(interaction, data, report, token) {
        const container = new ContainerBuilder().setAccentColor(ACCENT);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${this._t('report.title', interaction)}\n-# ${this._t('report.source', interaction, {
                bot: escapeMarkdown(data.bot?.app || data.bot?.pkg || '?'),
                count: Object.keys(data.modules).length
            })}`
        ));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${this._t('report.replace-warning', interaction)}`));
        container.addSeparatorComponents(new SeparatorBuilder());

        let shown = 0, moreModules = 0;
        for (const mod of report.modules) {
            if (shown >= MAX_MODULE_BLOCKS) { moreModules++; continue; }
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(this._moduleBlock(interaction, mod)));
            shown++;
        }
        if (moreModules)
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${this._t('report.more-modules', interaction, { count: moreModules })}`));

        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${this._t('report.totals', interaction, {
            apply: report.totals.apply, reset: report.totals.reset, skip: report.totals.skip
        })}`));

        const canApply = report.totals.apply + report.totals.reset > 0;
        const row = new ActionRowBuilder();
        if (canApply)
            row.addComponents(new ButtonBuilder().setCustomId(`settings:ioapply:${token}`).setStyle(ButtonStyle.Success).setLabel(this._t('buttons.apply', interaction)).setEmoji('✅'));
        row.addComponents(new ButtonBuilder().setCustomId(`settings:iocancel:${token}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.cancel', interaction)).setEmoji('✖️'));
        container.addActionRowComponents(row);

        return { flags: MessageFlags.IsComponentsV2, components: [container] };
    }

    /** One module's status block: a header line plus up to MAX_SKIP_PER_MODULE reasons. */
    _moduleBlock(interaction, mod) {
        if (mod.status === 'missing')
            return `⚠️ ${this._t('report.module-missing', interaction, { name: escapeMarkdown(mod.name) })}`;

        const lines = [`**${escapeMarkdown(mod.name)}** — ${this._t('report.module-counts', interaction, {
            apply: mod.counts.apply, reset: mod.counts.reset, skip: mod.counts.skip
        })}`];
        if (mod.versionMismatch)
            lines.push(`-# ℹ️ ${this._t('report.module-version', interaction, {
                name: escapeMarkdown(mod.name),
                from: mod.versionMismatch.from ?? '—',
                to: mod.versionMismatch.to ?? '—'
            })}`);

        const skips = mod.keys.filter(k => k.action === 'skip');
        for (const k of skips.slice(0, MAX_SKIP_PER_MODULE)) lines.push(`-# • \`${k.key}\`: ${this._skipReason(interaction, k.reason)}`);
        if (skips.length > MAX_SKIP_PER_MODULE)
            lines.push(`-# ${this._t('report.more-keys', interaction, { count: skips.length - MAX_SKIP_PER_MODULE })}`);
        return lines.join('\n');
    }

    /** Localized one-liner for why a key was skipped. */
    _skipReason(interaction, reason) {
        switch (reason?.code) {
            case 'unknown-key':  return this._t('report.key-unknown', interaction);
            case 'type-changed': return this._t('report.key-type', interaction, { from: reason.from, to: reason.to });
            case 'invalid':      return this._t('report.key-invalid', interaction, { error: truncate(reason.error, 120) });
            default:             return this._t('report.key-unknown', interaction);
        }
    }

    /** A terminal one-shot container (import applied / cancelled / expired). */
    _doneContainer(message, isError = false) {
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .setAccentColor(isError ? 0xE74C3C : OK_GREEN)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(message))]
        };
    }
};
