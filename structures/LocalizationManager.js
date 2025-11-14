const { parse } = require('yaml')
const fs = require("fs");
const path = require("path");
const Logger = require('./Logger');

module.exports = class LocalizationManager {
    /**
     * @param {{ defaultLang?: string, localesDir?: string }} options
     */
    constructor(options = {}) {
        this.defaultLang = options.defaultLang || "en-GB";
        this.localesDir = options.localesDir || path.join(__dirname, "..", "locales");
        this.languages = {};
        this.logger = new Logger('i18n');

        this.loadLocales();
    }

    loadLocales() {
        if (!fs.existsSync(this.localesDir)) {
            this.logger.warn(`Locales directory not found at ${this.localesDir}`);
            return;
        }

        const files = fs.readdirSync(this.localesDir).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
        
        for (const file of files) {
            const langCode = path.basename(file, path.extname(file));
            try {
                const content = parse(
                    fs.readFileSync(path.join(this.localesDir, file), "utf8")
                );
                // parse() can return null for empty files — ensure an object
                this.languages[langCode] = content || {};
                this.logger.verbose(`Loaded language ${langCode}`);
            } catch (err) {
                this.logger.error(`Failed to load ${file}:`, err);
            }
        }
    }

    /**
     * Resolve `a.b.c` into nested object.
     */
    _getKey(obj, key) {
        return key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }

    _interpolate(str, vars = {}) {
        if (str === undefined || str === null) return "";
        const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return Object.entries(vars).reduce((out, [k, v]) => {
            const pattern = new RegExp(`{{\\s*${escapeRegExp(k)}\\s*}}`, "g");
            // use a function replacement to avoid interpretation of `$` in replacement strings
            return out.replace(pattern, () => String(v));
        }, String(str));
    }

    /**
     * Translate a key into the specified language, interpolating variables as needed.
     * @param {string} key The translation key, e.g., "ping.reply"
     * @param {string} lang The language code (e.g., "en-GB")
     * @param {Object} [vars] The variables object for interpolation
     * @returns {string} The translated and interpolated string
     */
    t(key, lang, maybeVars) {
        let langCode = lang || this.defaultLang;
        let vars = maybeVars || {};

        const langObj = this.languages[langCode] || {};
        let value = this._getKey(langObj, key);

        // fallback to default language
        if (value === undefined && langCode !== this.defaultLang) {
            const defObj = this.languages[this.defaultLang] || {};
            value = this._getKey(defObj, key);
        }

        // last fallback: show the key
        if (value === undefined) {
            this.logger.warn(`Missing localization for key "${key}" in language "${langCode}"`);
            value = key;
        }

        if (typeof value === "string") {
            return this._interpolate(value, vars);
        }

        // If the value is an object/array, return a JSON string representation
        if (typeof value === "object" && value !== null) {
            try {
                return JSON.stringify(value, null, 2);
            } catch (e) {
                this.logger.error(`Error stringifying value for key "${key}" in language "${langCode}":`, e);
                return String(value);
            }
        }

        return String(value);
    }

    getLocalizationObject(key) {
        const localizationObj = {};
        for (const [langCode, langObj] of Object.entries(this.languages)) {
            const value = this._getKey(langObj, key);
            if (value !== undefined) {
                localizationObj[langCode] = value;
            }
        }
        return localizationObj;
    }
}