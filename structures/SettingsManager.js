const Logger = require('./Logger.js');

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Type validators / coercers. Each entry is a function that accepts the raw
 * input (often a string from a slash command), returns
 * `{ ok: true, value: <coerced> }` on success or
 * `{ ok: false, error: <message> }` on failure. For container types, the
 * helper `mkValidator(spec)` parses the type spec.
 */
const TYPES = {
    string: (v) => ({ ok: true, value: String(v) }),
    boolean: (v) => {
        if (typeof v === 'boolean') return { ok: true, value: v };
        const s = String(v).toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(s)) return { ok: true, value: true };
        if (['false', '0', 'no', 'off'].includes(s)) return { ok: true, value: false };
        return { ok: false, error: `expected boolean, got "${v}"` };
    },
    number: (v) => {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) return { ok: false, error: `expected number, got "${v}"` };
        return { ok: true, value: n };
    },
    integer: (v) => {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isInteger(n)) return { ok: false, error: `expected integer, got "${v}"` };
        return { ok: true, value: n };
    },
    snowflake: (v) => {
        const s = String(v).replace(/[<#@&!>]/g, '');
        if (!SNOWFLAKE.test(s)) return { ok: false, error: `expected Discord ID, got "${v}"` };
        return { ok: true, value: s };
    }
};
TYPES.channel = TYPES.snowflake;
TYPES.role = TYPES.snowflake;
TYPES.user = TYPES.snowflake;

/**
 * Parse a type spec (e.g. `array<string>`, `enum:foo|bar|baz`) into a
 * validator function `(value) -> { ok, value | error }`.
 */
function mkValidator(spec) {
    if (typeof spec === 'function') return spec;

    const arrMatch = String(spec).match(/^array<(.+)>$/);
    if (arrMatch) {
        const inner = mkValidator(arrMatch[1]);
        return (v) => {
            const arr = Array.isArray(v) ? v : [v];
            const out = [];
            for (const item of arr) {
                const r = inner(item);
                if (!r.ok) return r;
                out.push(r.value);
            }
            return { ok: true, value: out };
        };
    }

    if (String(spec).startsWith('enum:')) {
        const choices = String(spec).slice(5).split('|');
        return (v) => {
            const s = String(v);
            if (!choices.includes(s)) return { ok: false, error: `expected one of ${choices.join(', ')}` };
            return { ok: true, value: s };
        };
    }

    const t = TYPES[spec];
    if (!t) throw new Error(`Unknown setting type: "${spec}"`);
    return t;
}

/**
 * Schema-driven per-guild settings store. Modules declare a schema:
 *
 *   settings: {
 *     welcomeChannel: { type: 'channel',       default: null,  description: '…' },
 *     autoMod:        { type: 'boolean',       default: false, description: '…' },
 *     bannedWords:    { type: 'array<string>', default: [],    description: '…' },
 *     prefix:         { type: 'string',        default: '!',   description: '…',  validate: v => v.length <= 3 },
 *   }
 *
 * Storage shape: one record per guild — `{ id: guildId, settings: { key: value } }`.
 * Live in the `settings` collection of the module's database handle. Module-side
 * gating is intentionally absent: the `/settings` command itself is gated by
 * Discord-native permissions, and admins delegate per-key access by setting
 * `settingOverrides` via `/permissions override setting`.
 */
module.exports = class SettingsManager {
    /**
     * @param {import('..')} client
     * @param {import('./Module')} module
     * @param {object} schema Map of `key -> { type, default, description?, validate? }`.
     */
    constructor(client, module, schema = {}) {
        this.client = client;
        this.module = module;
        this.logger = new Logger(`Settings:${module.options.name}`);

        this._schema = {};
        for (const [key, def] of Object.entries(schema)) {
            if (!def || typeof def !== 'object' || !('type' in def))
                throw new Error(`Setting "${module.options.name}.${key}" is missing a type.`);
            this._schema[key] = {
                type: def.type,
                default: 'default' in def ? def.default : null,
                description: def.description || '',
                validate: def.validate || null,
                _validator: mkValidator(def.type)
            };
        }

        this._cache = new Map();
        client.settings.set(module.options.name, this);
    }

    get schema() {
        const out = {};
        for (const [key, def] of Object.entries(this._schema)) {
            out[key] = {
                type: def.type,
                default: def.default,
                description: def.description
            };
        }
        return out;
    }

    keys() { return Object.keys(this._schema); }

    has(key) { return key in this._schema; }

    /** Default values for every key in the schema. */
    defaults() {
        const out = {};
        for (const [key, def] of Object.entries(this._schema)) out[key] = this._cloneDefault(def.default);
        return out;
    }

    _cloneDefault(v) {
        if (v == null) return v;
        if (Array.isArray(v)) return [...v];
        if (typeof v === 'object') return { ...v };
        return v;
    }

    _collection() {
        const handle = this.client.database.get(this.module.options.name);
        if (!handle) throw new Error(`Module "${this.module.options.name}" has no database handle — declare \`databases\` or \`settings\` in module options.`);
        return handle.collection('settings');
    }

    /**
     * Get the full settings record for a guild. Missing keys are filled with
     * defaults — but only in the returned object, not persisted.
     * @returns {{ id: string, settings: object }}
     */
    get(guildId) {
        const cached = this._cache.get(guildId);
        if (cached) return cached;

        const col = this._collection();
        let record = col.findOne({ id: guildId });
        if (!record) {
            record = col.insert({ id: guildId, settings: this.defaults() });
        } else {
            // Backfill keys added in newer schema versions.
            let mutated = false;
            for (const [key, def] of Object.entries(this._schema)) {
                if (!(key in record.settings)) {
                    record.settings[key] = this._cloneDefault(def.default);
                    mutated = true;
                }
            }
            if (mutated) col.update(record);
        }

        this._cache.set(guildId, record);
        return record;
    }

    /** Convenience: just the value of a single key (or default). */
    getKey(guildId, key) {
        if (!this.has(key)) throw new Error(`Unknown setting "${key}".`);
        return this.get(guildId).settings[key];
    }

    /**
     * Validate a value against a key's declared type. Returns coerced value or
     * throws with an error message.
     */
    _validate(key, value) {
        const def = this._schema[key];
        if (!def) throw new Error(`Unknown setting "${key}".`);
        const result = def._validator(value);
        if (!result.ok) throw new Error(`Invalid value for "${key}": ${result.error}`);
        if (def.validate) {
            const ok = def.validate(result.value);
            if (ok === false) throw new Error(`Invalid value for "${key}": rejected by custom validator`);
            if (typeof ok === 'string') throw new Error(`Invalid value for "${key}": ${ok}`);
        }
        return result.value;
    }

    /**
     * Override-driven authorization. The `/settings` command itself is gated
     * by Discord-native permissions; this layer only enforces an admin-set
     * `settingOverrides[Module.key]` if one exists. No module-side defaults.
     * Pass `actor` as a GuildMember to enable the check; null/undefined skips.
     */
    _authorize(key, actor) {
        if (!actor) return;
        const ok = this.client.permissions.check(actor, {
            settingKey: `${this.module.options.name}.${key}`
        });
        if (!ok) throw new Error(`Missing permission to modify "${key}" in this guild.`);
    }

    /**
     * Set a key to a value. Validates against the schema; coerces strings
     * (e.g. `"true"` → `true` for boolean keys). If `actor` is supplied, the
     * key's `requires` permission is enforced.
     * @param {string} guildId
     * @param {string} key
     * @param {*} value
     * @param {object} [options]
     * @param {import('discord.js').GuildMember} [options.actor]
     */
    set(guildId, key, value, options = {}) {
        const coerced = this._validate(key, value);
        this._authorize(key, options.actor);

        const record = this.get(guildId);
        record.settings[key] = coerced;
        this._collection().update(record);
        this._cache.set(guildId, record);
        return coerced;
    }

    /**
     * Append `value` to an array-typed key. Errors if the key isn't an array
     * type. Duplicates are allowed unless caller filters.
     */
    add(guildId, key, value, options = {}) {
        if (!String(this._schema[key]?.type).startsWith('array<'))
            throw new Error(`"${key}" is not an array setting.`);
        this._authorize(key, options.actor);

        const innerSpec = this._schema[key].type.match(/^array<(.+)>$/)[1];
        const innerValidator = mkValidator(innerSpec);
        const r = innerValidator(value);
        if (!r.ok) throw new Error(`Invalid value for "${key}": ${r.error}`);

        const record = this.get(guildId);
        const arr = Array.isArray(record.settings[key]) ? record.settings[key] : [];
        arr.push(r.value);
        record.settings[key] = arr;
        this._collection().update(record);
        this._cache.set(guildId, record);
        return arr;
    }

    /** Remove `value` from an array-typed key. */
    remove(guildId, key, value, options = {}) {
        if (!String(this._schema[key]?.type).startsWith('array<'))
            throw new Error(`"${key}" is not an array setting.`);
        this._authorize(key, options.actor);

        const innerSpec = this._schema[key].type.match(/^array<(.+)>$/)[1];
        const innerValidator = mkValidator(innerSpec);
        const r = innerValidator(value);
        if (!r.ok) throw new Error(`Invalid value for "${key}": ${r.error}`);

        const record = this.get(guildId);
        const arr = Array.isArray(record.settings[key]) ? record.settings[key] : [];
        record.settings[key] = arr.filter(x => x !== r.value);
        this._collection().update(record);
        this._cache.set(guildId, record);
        return record.settings[key];
    }

    /** Reset a single key to its default. */
    reset(guildId, key, options = {}) {
        if (!this.has(key)) throw new Error(`Unknown setting "${key}".`);
        this._authorize(key, options.actor);

        const record = this.get(guildId);
        record.settings[key] = this._cloneDefault(this._schema[key].default);
        this._collection().update(record);
        this._cache.set(guildId, record);
        return record.settings[key];
    }

    /** Reset every key in this module to defaults. */
    factoryReset(guildId, options = {}) {
        for (const key of this.keys()) this._authorize(key, options.actor);
        const record = this.get(guildId);
        record.settings = this.defaults();
        this._collection().update(record);
        this._cache.set(guildId, record);
        return record;
    }
};
