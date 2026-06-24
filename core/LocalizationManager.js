const { parse, stringify } = require('yaml');
const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');

const YAML_EXTS = ['.yml', '.yaml'];

/** `{{ name }}` placeholder pattern — compiled once, reused for every interpolation. */
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Loads module-level strings from `/modules/<Module>/locales/<lang>.<yml|yaml>`.
 * Per-module strings are merged under `modules.<Module>` in the language
 * tree, so modules ship their translations alongside their code.
 *
 * Auto-sync: on boot, missing keys are added to non-reference locale files
 * with the dotted path of the key as their value (so untranslated entries
 * are visible to translators in the file and to end-users at runtime).
 */
module.exports = class LocalizationManager {
    /**
     * @param {object} [options]
     * @param {string} [options.defaultLang]
     * @param {string} [options.referenceLanguage] Language used as the source of truth for auto-sync. Defaults to `defaultLang`.
     * @param {string} [options.modulesDir] Where to look for `<Module>/locales/`.
     * @param {boolean} [options.autoSync]
     * @param {boolean} [options.hotReload]
     */
    constructor(options = {}) {
        this.defaultLang = options.defaultLang || 'en-GB';
        this.referenceLanguage = options.referenceLanguage || this.defaultLang;
        this.modulesDir = options.modulesDir || path.join(__dirname, '..', 'modules');
        this.autoSync = options.autoSync !== false;
        this.hotReload = options.hotReload === true;

        this.languages = {};
        /** Per-language file index: `{ [lang]: { [Module]: filePath } }`. */
        this._files = {};
        this.logger = new Logger('i18n');
        this._watchers = [];
        /** Per-interaction resolved-language memo (GC-safe, no eviction). */
        this._langCache = new WeakMap();

        this.load();
        if (this.autoSync) this.syncMissingKeys();
        this.reportCoverage();
        if (this.hotReload) this._installWatchers();
    }

    load() {
        this.languages = {};
        this._files = {};

        if (!fs.existsSync(this.modulesDir)) return;
        const moduleDirs = fs.readdirSync(this.modulesDir, { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);

        for (const moduleName of moduleDirs) {
            const dir = path.join(this.modulesDir, moduleName, 'locales');
            if (!fs.existsSync(dir)) continue;

            const files = fs.readdirSync(dir).filter(f => YAML_EXTS.includes(path.extname(f)));
            for (const file of files) {
                const lang = path.basename(file, path.extname(file));
                const filePath = path.join(dir, file);
                const content = this._readYaml(filePath);

                if (!this.languages[lang]) this.languages[lang] = { modules: {} };
                if (!this.languages[lang].modules) this.languages[lang].modules = {};
                if (!this._files[lang]) this._files[lang] = {};

                this._files[lang][moduleName] = filePath;
                this.languages[lang].modules[moduleName] = this._deepMerge(
                    this.languages[lang].modules[moduleName] || {},
                    content
                );
            }
        }
    }

    _readYaml(filePath) {
        try {
            const text = fs.readFileSync(filePath, 'utf8');
            return parse(text) || {};
        } catch (err) {
            this.logger.error(`Failed to load ${filePath}: ${err.message}`);
            return {};
        }
    }

    /**
     * For each module locale file, ensure every key present in the reference
     * language exists. Missing keys are inserted with their dotted path as
     * the value. Existing translations are never modified.
     */
    syncMissingKeys() {
        const refFiles = this._files[this.referenceLanguage];
        if (!refFiles) {
            this.logger.warn(`Reference language "${this.referenceLanguage}" not loaded — skipping auto-sync.`);
            return;
        }

        for (const lang of Object.keys(this.languages)) {
            if (lang === this.referenceLanguage) continue;
            this._syncLanguage(lang);
        }
    }

    _syncLanguage(lang) {
        const refFiles = this._files[this.referenceLanguage];
        const targetFiles = this._files[lang] || (this._files[lang] = {});

        for (const [moduleName, refPath] of Object.entries(refFiles)) {
            const refTree = this._readYaml(refPath);
            const targetPath = targetFiles[moduleName]
                || path.join(this.modulesDir, moduleName, 'locales', `${lang}.yaml`);
            const targetTree = fs.existsSync(targetPath) ? this._readYaml(targetPath) : {};
            const { merged, added } = this._fillMissing(refTree, targetTree, '');

            if (added > 0) {
                fs.writeFileSync(targetPath, stringify(merged));
                targetFiles[moduleName] = targetPath;
                this.logger.info(`[${lang}] ${moduleName}: stubbed ${added} missing key(s) at ${path.relative(process.cwd(), targetPath)}`);

                if (!this.languages[lang]) this.languages[lang] = { modules: {} };
                if (!this.languages[lang].modules) this.languages[lang].modules = {};
                this.languages[lang].modules[moduleName] = this._deepMerge(
                    this.languages[lang].modules[moduleName] || {},
                    merged
                );
            }
        }
    }

    /**
     * Recursive walk: any leaf in `ref` not present in `target` is inserted
     * with its dotted path (relative to the file root) as the value. Returns
     * the resulting target tree and a count of insertions.
     */
    _fillMissing(ref, target, prefix) {
        let added = 0;
        const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};

        for (const [key, refVal] of Object.entries(ref || {})) {
            const dotted = prefix ? `${prefix}.${key}` : key;
            if (refVal && typeof refVal === 'object' && !Array.isArray(refVal)) {
                const childTarget = (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) ? out[key] : {};
                const { merged: childMerged, added: childAdded } = this._fillMissing(refVal, childTarget, dotted);
                out[key] = childMerged;
                added += childAdded;
            } else {
                if (!(target && key in target)) {
                    out[key] = dotted;
                    added++;
                }
            }
        }
        return { merged: out, added };
    }

    _getKey(obj, key) {
        return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }

    _interpolate(str, vars = {}) {
        if (str == null) return '';
        // Single pass over the string with one precompiled regex. The function
        // replacer keeps `$`/`$&` in values literal; unmatched placeholders
        // (no var, or an explicit null/undefined value) are left as-is.
        return String(str).replace(PLACEHOLDER, (match, key) =>
            vars[key] != null ? String(vars[key]) : match);
    }

    /**
     * Resolve a Discord-style locale (`en-US`, `it`, `pt-BR`, …) against the
     * loaded languages. Tries exact → same base (`en-US` → first `en-*`) →
     * default. Returns the resolved language code (or null if nothing fits).
     */
    resolveLanguage(requested) {
        if (!requested || typeof requested !== 'string')
            return this.languages[this.defaultLang] ? this.defaultLang : null;
        if (this.languages[requested]) return requested;

        const base = requested.split('-')[0];
        const sibling = Object.keys(this.languages).find(l => l === base || l.split('-')[0] === base);
        if (sibling) return sibling;

        return this.languages[this.defaultLang] ? this.defaultLang : null;
    }

    /**
     * Resolve the effective language for a Discord interaction, memoized for
     * the lifetime of the interaction object. A single response often renders
     * many translated strings; without this every `Module.t(key, interaction)`
     * call would re-run the full guild-settings + user-record + locale
     * resolution. The resolved language cannot change within one interaction,
     * so the result is cached in a WeakMap keyed by the interaction.
     *
     * Resolution order: user-forced → guild default → Discord interaction
     * locale → bot default. User language is read-only (`getUser`), so
     * rendering never creates DB rows or triggers owner reconciliation as a
     * side effect — that belongs in the command path, not in translation.
     *
     * @param {import('..')} client
     * @param {import('discord.js').BaseInteraction} interaction
     * @returns {string}
     */
    resolveInteractionLang(client, interaction) {
        const cached = this._langCache.get(interaction);
        if (cached) return cached;

        const guildLang = interaction.guild
            ? client.modules.getModule('Utility')?.settings?.get(interaction.guild.id)?.settings?.defaultServerLanguage
            : null;
        const userLang = client.database.getUser?.(interaction.user.id)?.language;

        let lang = this.defaultLang;
        const candidates = [userLang, guildLang, interaction.locale];
        for (const candidate of candidates) {
            const resolved = candidate && this.resolveLanguage(candidate);
            if (resolved && this.languages[resolved]) { lang = resolved; break; }
        }

        this._langCache.set(interaction, lang);
        return lang;
    }

    /**
     * Translate a key. Returns the raw value (string or object/array — not
     * JSON-stringified). For string values, `{{var}}` placeholders are
     * interpolated from `vars`. For non-string values, `vars` is ignored.
     * @param {string} key
     * @param {string} [lang]
     * @param {object} [vars]
     */
    t(key, lang, vars) {
        const langCode = this.resolveLanguage(lang) || this.defaultLang;
        const langObj = this.languages[langCode] || {};
        let value = this._getKey(langObj, key);

        if (value === undefined && langCode !== this.defaultLang)
            value = this._getKey(this.languages[this.defaultLang] || {}, key);

        if (value === undefined) {
            this.logger.warn(`Missing localization for key "${key}" in language "${langCode}"`);
            return key;
        }

        if (typeof value === 'string') return this._interpolate(value, vars);
        return value;
    }

    /**
     * Build a Discord-friendly localization map: `{ "en-US": "...", "it": "..." }`
     * for every loaded language that defines `key`. Skips auto-sync stubs so
     * Discord never receives a dotted path as a localized command name.
     */
    getLocalizationObject(key) {
        const out = {};
        for (const [lang, tree] of Object.entries(this.languages)) {
            const value = this._getKey(tree, key);
            if (value === undefined) continue;
            if (typeof value !== 'string') continue;
            // Skip auto-sync stubs (value is a dotted suffix of the lookup key)
            if (value.includes('.') && !/\s/.test(value) && key.endsWith(value)) continue;
            out[lang] = value;
        }
        return out;
    }

    /**
     * Human-readable name for a language code, via Intl.DisplayNames.
     * @param {string} code Language code (e.g., 'en-GB', 'it').
     * @param {string} [displayIn] Locale to render the name in. Defaults to the language itself (so 'it' renders as 'italiano').
     * @returns {string}
     */
    languageName(code, displayIn) {
        try {
            const dn = new Intl.DisplayNames([displayIn || code], { type: 'language' });
            const name = dn.of(code);
            if (!name || name === code) return code;
            return name.charAt(0).toUpperCase() + name.slice(1);
        } catch {
            return code;
        }
    }

    reportCoverage() {
        const ref = this.languages[this.referenceLanguage];
        if (!ref) {
            this.logger.warn(`No reference language loaded.`);
            return;
        }
        const refLeaves = this._countLeaves(ref);
        const summary = Object.keys(this.languages).map(lang => {
            if (lang === this.referenceLanguage) return `${lang} (ref): ${refLeaves}`;
            const tree = this.languages[lang];
            const present = this._countLeaves(tree, ref);
            return `${lang}: ${present}/${refLeaves}`;
        });
        this.logger.success(`Loaded ${Object.keys(this.languages).length} language(s) — ${summary.join(' | ')}`);
    }

    /** Count leaf keys in `tree` that are present (any value) AND, if `ref` is provided, that exist in ref. */
    _countLeaves(tree, ref) {
        const walk = (node, refNode) => {
            let n = 0;
            for (const [k, v] of Object.entries(node || {})) {
                const refV = refNode ? refNode[k] : undefined;
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    n += walk(v, refV && typeof refV === 'object' ? refV : undefined);
                } else if (refNode === undefined || refV !== undefined) {
                    n++;
                }
            }
            return n;
        };
        return walk(tree, ref);
    }

    _installWatchers() {
        if (!fs.existsSync(this.modulesDir)) return;
        const watch = (dir) => {
            if (!fs.existsSync(dir)) return;
            try {
                const w = fs.watch(dir, { persistent: false }, () => this._scheduleReload());
                this._watchers.push(w);
            } catch { /* fs.watch unsupported, ignore */ }
        };
        for (const d of fs.readdirSync(this.modulesDir, { withFileTypes: true })) {
            if (d.isDirectory()) watch(path.join(this.modulesDir, d.name, 'locales'));
        }
    }

    _scheduleReload() {
        clearTimeout(this._reloadTimer);
        this._reloadTimer = setTimeout(() => {
            this.logger.info('Locale file change detected — reloading.');
            this.load();
            if (this.autoSync) this.syncMissingKeys();
        }, 500);
    }

    _deepMerge(base, override) {
        if (!base || typeof base !== 'object') return override;
        if (!override || typeof override !== 'object') return base;
        if (Array.isArray(override)) return override;
        const out = { ...base };
        for (const [k, v] of Object.entries(override)) {
            if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
                out[k] = this._deepMerge(out[k], v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }
};
