const Logger = require('./Logger.js');

const SNOWFLAKE = /^\d{17,20}$/;

/** Full custom-emoji mention: `<:name:id>` / `<a:name:id>` (names are 2–32 word chars). */
const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{17,20}>$/;
/**
 * Code points that may legitimately appear inside a single Unicode emoji token:
 * pictographs, regional-indicator (flag) letters, skin-tone modifiers, the ZWJ
 * (U+200D) and variation selector (U+FE0F) that join sequences, and the keycap
 * combiner (U+20E3) plus the digit / `#` / `*` bases it attaches to.
 */
const EMOJI_PARTS = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}‍️⃣#*0-9]/gu;
/** A token must carry one of these to actually be an emoji (rejects bare digits / `#` / `*`). */
const EMOJI_SIGNAL = /[\p{Extended_Pictographic}\p{Regional_Indicator}⃣]/u;

/**
 * Type validators / coercers. Each entry is a function that accepts the raw
 * input (often a string from a slash command), returns
 * `{ ok: true, value: <coerced> }` on success or
 * `{ ok: false, error: <message> }` on failure. For container types, the
 * helper `mkValidator(def)` parses the type spec.
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
    },
    /**
     * A Discord emoji usable with `.setEmoji()`: a raw Unicode emoji (incl. VS16 /
     * ZWJ sequences, flags and keycaps) or a full custom mention `<:name:id>` /
     * `<a:name:id>`. Rejects the values that break Components at send time with
     * COMPONENT_INVALID_EMOJI — shortcodes (`:fire:`), bare custom names / ids, and
     * arbitrary text. Custom-emoji *renderability* (the bot actually sharing that
     * emoji) is a render-time concern and intentionally not checked here.
     */
    emoji: (v) => {
        const s = String(v).trim();
        if (!s) return { ok: false, error: 'expected an emoji, got an empty value' };
        if (CUSTOM_EMOJI.test(s)) return { ok: true, value: s };
        if (EMOJI_SIGNAL.test(s) && s.replace(EMOJI_PARTS, '') === '') return { ok: true, value: s };
        return { ok: false, error: `expected a Unicode emoji or a custom emoji like <:name:id>, got "${v}"` };
    }
};
TYPES.channel = TYPES.snowflake;
TYPES.role = TYPES.snowflake;
TYPES.user = TYPES.snowflake;

/** A def may be authored as a bare type string (`'string'`) or a full object. */
function normDef(def) {
    if (def == null) return null;
    return typeof def === 'string' ? { type: def } : def;
}

/**
 * Wrap a structural/scalar core validator with the def's optional `validate`
 * hook so cross-field rules run at every level (not just the top key). The hook
 * may return `true`/undefined (ok), `false` (generic reject), or a string (the
 * error message).
 */
function withValidate(spec, core) {
    if (!spec || typeof spec.validate !== 'function') return core;
    return (v) => {
        const r = core(v);
        if (!r.ok) return r;
        const ok = spec.validate(r.value);
        if (ok === false) return { ok: false, error: 'rejected by custom validator' };
        if (typeof ok === 'string') return { ok: false, error: ok };
        return r;
    };
}

/**
 * Build a validator function `(value) -> { ok, value | error }` from a setting
 * def. Accepts either a bare type string (back-compat) or a full def object so
 * the two structural types can see their `fields` / `item` sub-schemas.
 *
 * Supported `type`s:
 *   - scalars: string number integer boolean snowflake channel role user emoji
 *   - `enum:a|b|c`, `array<innerScalar>`
 *   - `object` — a fixed set of named `fields` (a sub-schema)
 *   - `list`   — a variable-length sequence of `item`s (objects or scalars)
 *
 * Structural types nest to any depth in any combination — `object` fields may
 * be scalars, `array<scalar>`, `list`s, or nested `object`s. An object field
 * with an explicit `default: null` stays unset until edited (used for optional
 * sub-objects); otherwise it materialises its own fields' defaults.
 */
function mkValidator(def) {
    if (typeof def === 'function') return def;
    const spec = normDef(def);
    const type = String(spec.type);

    if (type === 'object') {
        const fields = spec.fields || {};
        // Build-time guard: the reserved-character rule on field names (§3).
        // Objects may nest directly in objects (§2): a field whose default is
        // `null` stays unset until edited; otherwise it materialises its own
        // fields' defaults.
        for (const name of Object.keys(fields)) {
            if (/[:.]/.test(name))
                throw new Error(`Field name "${name}" must not contain ':' or '.' — reserved by the settings UI path encoding (SETTINGS_NESTED §3).`);
        }
        const entries = Object.entries(fields).map(([name, fdef]) => {
            const ftype = String(normDef(fdef).type);
            return {
                name,
                type: ftype,
                validate: mkValidator(fdef),
                structural: ftype === 'object' || ftype === 'list' || /^array<.+>$/.test(ftype),
                default: normDef(fdef).default
            };
        });
        return withValidate(spec, (v) => {
            if (typeof v !== 'object' || Array.isArray(v) || v == null) return { ok: false, error: 'expected an object' };
            const out = {};
            for (const { name, type: ftype, validate, structural, default: dflt } of entries) {
                let raw = (name in v && v[name] != null) ? v[name] : dflt;
                if (raw == null) {
                    // Unset: scalar/enum → null; list/array → empty; object with an
                    // explicit `null` default stays null, else materialises its
                    // fields' defaults (validating `{}` fills them recursively).
                    if (!structural) { out[name] = null; continue; }
                    if (ftype === 'object') {
                        if (dflt === null) { out[name] = null; continue; }
                        raw = {};
                    } else {
                        raw = [];
                    }
                }
                const r = validate(raw);
                if (!r.ok) return { ok: false, error: `${name}: ${r.error}` };
                out[name] = r.value;
            }
            return { ok: true, value: out };
        });
    }

    if (type === 'list') {
        const itemValidator = mkValidator(spec.item);
        return withValidate(spec, (v) => {
            const arr = Array.isArray(v) ? v : [];
            if (spec.maxItems != null && arr.length > spec.maxItems)
                return { ok: false, error: `at most ${spec.maxItems} item(s)` };
            const out = [];
            for (let i = 0; i < arr.length; i++) {
                const r = itemValidator(arr[i]);
                if (!r.ok) return { ok: false, error: `[${i}] ${r.error}` };
                out.push(r.value);
            }
            return { ok: true, value: out };
        });
    }

    const arrMatch = type.match(/^array<(.+)>$/);
    if (arrMatch) {
        const inner = mkValidator(arrMatch[1]);
        return withValidate(spec, (v) => {
            const arr = Array.isArray(v) ? v : [v];
            const out = [];
            for (const item of arr) {
                const r = inner(item);
                if (!r.ok) return r;
                out.push(r.value);
            }
            return { ok: true, value: out };
        });
    }

    if (type.startsWith('enum:')) {
        const choices = type.slice(5).split('|');
        return withValidate(spec, (v) => {
            const s = String(v);
            if (!choices.includes(s)) return { ok: false, error: `expected one of ${choices.join(', ')}` };
            return { ok: true, value: s };
        });
    }

    const t = TYPES[type];
    if (!t) throw new Error(`Unknown setting type: "${type}"`);
    return withValidate(spec, t);
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
 * Keys may also be **structural** — nested objects and lists of objects, nested
 * to any depth (SETTINGS_NESTED.md):
 *
 *   roles: {
 *     type: 'list', label: 'name', default: [],
 *     item: { type: 'object', fields: {
 *       value: { type: 'string' }, name: { type: 'string' },
 *       perms: { type: 'array<role>', default: [] },
 *     } }
 *   }
 *
 * Storage shape: one record per guild — `{ id: guildId, settings: { key: value } }`,
 * where each key holds its whole (possibly nested) value verbatim. Lives in the
 * `settings` collection of the module's database handle. There is no per-key
 * gating: access is governed entirely by who can run the `/settings` command,
 * which is gated by Discord-native permissions (ManageGuild by default).
 */
module.exports = class SettingsManager {
    /**
     * @param {import('..')} client
     * @param {import('./Module')} module
     * @param {object} schema Map of `key -> def`. A def is `{ type, default?, description?, validate? }`
     *   plus, for structural types, `fields` (object) or `item`/`label`/`maxItems` (list).
     */
    constructor(client, module, schema = {}) {
        this.client = client;
        this.module = module;
        this.logger = new Logger(`Settings:${module.options.name}`);

        this._schema = {};
        for (const [key, def] of Object.entries(schema)) {
            if (!def || typeof def !== 'object' || !('type' in def))
                throw new Error(`Setting "${module.options.name}.${key}" is missing a type.`);
            if (/[:.]/.test(key))
                throw new Error(`Setting key "${module.options.name}.${key}" must not contain ':' or '.' — reserved by the settings UI path encoding.`);

            const structural = def.type === 'object' || def.type === 'list';
            this._schema[key] = {
                type: def.type,
                // Structural keys without an explicit default materialise theirs
                // from `fields`/`item`; scalars fall back to null as before.
                default: 'default' in def ? def.default : (structural ? undefined : null),
                description: def.description || '',
                validate: def.validate || null,
                fields: def.fields,
                item: def.item,
                label: def.label,
                maxItems: def.maxItems,
                _validator: mkValidator(def)
            };
        }

        this._cache = new Map();
        client.settings.set(module.options.name, this);
    }

    /**
     * Public schema view. Exposes the structural sub-schema (`fields`/`item`/
     * `label`/`maxItems`) so the `/settings` UI can render drill-down screens.
     */
    get schema() {
        const out = {};
        for (const [key, def] of Object.entries(this._schema)) {
            out[key] = { type: def.type, default: def.default, description: def.description };
            if (def.fields) out[key].fields = def.fields;
            if (def.item) out[key].item = def.item;
            if (def.label) out[key].label = def.label;
            if (def.maxItems != null) out[key].maxItems = def.maxItems;
        }
        return out;
    }

    keys() { return Object.keys(this._schema); }

    has(key) { return key in this._schema; }

    /** Default values for every key in the schema (deeply materialised). */
    defaults() {
        const out = {};
        for (const [key, def] of Object.entries(this._schema)) out[key] = this._defaultFor(def);
        return out;
    }

    _normDef(def) { return normDef(def); }

    _deepClone(v) {
        if (v == null || typeof v !== 'object') return v;
        return JSON.parse(JSON.stringify(v));
    }

    /**
     * Recursively materialise a def's default: `object` → `{ field: default… }`
     * (or `null` if the object's own default is explicitly null), `list` → its
     * default array (usually `[]`), scalars → their (cloned) default or null.
     */
    _defaultFor(def) {
        const spec = normDef(def);
        if (!spec) return null;
        const type = String(spec.type);
        if (type === 'object') {
            if (spec.default === null) return null;
            const out = {};
            for (const [name, fdef] of Object.entries(spec.fields || {})) out[name] = this._defaultFor(fdef);
            return out;
        }
        if (type === 'list') {
            return Array.isArray(spec.default) ? this._deepClone(spec.default) : [];
        }
        return 'default' in spec ? this._deepClone(spec.default) : null;
    }

    /**
     * Recursively fill defaults into a stored `value` for `def`, so adding new
     * sub-fields to a schema later doesn't break existing rows. Object fields
     * absent from the stored value are filled; list items are each run through
     * their item-def (item *count* is user data and never changed).
     */
    _withDefaults(def, value) {
        const spec = normDef(def);
        const type = String(spec.type);
        if (type === 'object') {
            if (value == null || typeof value !== 'object' || Array.isArray(value)) return this._defaultFor(spec);
            const out = { ...value };
            for (const [name, fdef] of Object.entries(spec.fields || {}))
                out[name] = (name in value) ? this._withDefaults(fdef, value[name]) : this._defaultFor(fdef);
            return out;
        }
        if (type === 'list') {
            const arr = Array.isArray(value) ? value : this._defaultFor(spec);
            return arr.map(item => this._withDefaults(spec.item, item));
        }
        return value === undefined ? this._defaultFor(spec) : value;
    }

    _collection() {
        const handle = this.client.database.get(this.module.options.name);
        if (!handle) throw new Error(`Module "${this.module.options.name}" has no database handle — declare \`databases\` or \`settings\` in module options.`);
        return handle.collection('settings');
    }

    /**
     * Get the full settings record for a guild. Missing keys are filled with
     * defaults, and stored nested values are deeply back-filled with any new
     * sub-fields — persisted only when something actually changed.
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
            // Backfill keys added in newer schema versions, and (deeply) any new
            // sub-fields inside existing structural values.
            let mutated = false;
            for (const [key, def] of Object.entries(this._schema)) {
                if (!(key in record.settings)) {
                    record.settings[key] = this._defaultFor(def);
                    mutated = true;
                } else {
                    const filled = this._withDefaults(def, record.settings[key]);
                    if (JSON.stringify(filled) !== JSON.stringify(record.settings[key])) {
                        record.settings[key] = filled;
                        mutated = true;
                    }
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
     * Validate a value against a key's declared type (structural types validate
     * the whole nested tree). Returns the coerced value or throws.
     */
    _validate(key, value) {
        const def = this._schema[key];
        if (!def) throw new Error(`Unknown setting "${key}".`);
        const result = def._validator(value);
        if (!result.ok) throw new Error(`Invalid value for "${key}": ${result.error}`);
        return result.value;
    }

    /**
     * Set a key to a value. Validates against the schema; coerces strings
     * (e.g. `"true"` → `true` for boolean keys). For structural keys the *whole*
     * nested value is validated, so writing any nested leaf re-checks integrity.
     * Access is governed by the `/settings` command's Discord-native gating.
     * @param {string} guildId
     * @param {string} key
     * @param {*} value
     */
    set(guildId, key, value) {
        const coerced = this._validate(key, value);

        const record = this.get(guildId);
        record.settings[key] = coerced;
        this._collection().update(record);
        this._cache.set(guildId, record);
        return coerced;
    }

    // ── Path-addressed access (for the nested-settings UI / migrations) ──────
    //
    // A `path` is an array of segments locating a node inside a key's value:
    // a field name (object) or an index (list). `[]` is the key's own value.

    /** Walk `path` (array of segments) into `root`, returning the node or undefined. */
    static getAtPath(root, path) {
        let node = root;
        for (const seg of path) {
            if (node == null) return undefined;
            node = Array.isArray(node) ? node[Number(seg)] : node[seg];
        }
        return node;
    }

    /** Immutably return `root` with the node at `path` replaced by `value`. */
    static setAtPath(root, path, value) {
        if (!path.length) return value;
        const [head, ...rest] = path;
        if (Array.isArray(root)) {
            const idx = Number(head);
            const copy = root.slice();
            copy[idx] = SettingsManager.setAtPath(copy[idx], rest, value);
            return copy;
        }
        const copy = { ...(root || {}) };
        copy[head] = SettingsManager.setAtPath(copy[head], rest, value);
        return copy;
    }

    /** Resolve the (normalised) def at `path` within a key's schema. */
    defAt(key, path = []) {
        let def = normDef(this._schema[key]);
        for (const seg of path) {
            if (!def) return null;
            if (def.type === 'object') def = normDef(def.fields?.[seg]);
            else if (def.type === 'list') def = normDef(def.item);
            else return null;
        }
        return def;
    }

    /** Read the value at `path` inside a key. */
    getPath(guildId, key, path = []) {
        return SettingsManager.getAtPath(this.getKey(guildId, key), path);
    }

    /** Set the value at `path` inside a key (re-validates the whole key). */
    setPath(guildId, key, path, value) {
        const root = this._deepClone(this.getKey(guildId, key));
        const next = SettingsManager.setAtPath(root, path, value);
        return this.set(guildId, key, next);
    }

    /** Reset the node at `path` to its default (re-validates the whole key). */
    resetPath(guildId, key, path = []) {
        const def = this.defAt(key, path);
        if (!def) throw new Error(`No setting at "${key}${path.length ? '.' + path.join('.') : ''}".`);
        return this.setPath(guildId, key, path, this._defaultFor(def));
    }

    // ── List mutations (validate + persist + cache, like add/remove) ─────────
    // `path` points at the *list*; `index` selects the item.

    /** Append an item (item-def defaults if omitted) to the list at `path`. */
    listAdd(guildId, key, path = [], item) {
        const listDef = this.defAt(key, path);
        if (!listDef || listDef.type !== 'list') throw new Error(`"${key}${path.length ? '.' + path.join('.') : ''}" is not a list.`);
        const root = this._deepClone(this.getKey(guildId, key));
        const arr = SettingsManager.getAtPath(root, path);
        const list = Array.isArray(arr) ? arr : [];
        const newItem = item !== undefined ? item : this._defaultFor(listDef.item);
        return this.set(guildId, key, SettingsManager.setAtPath(root, path, [...list, newItem]));
    }

    /** Replace the item at `index` in the list at `path`. */
    listUpdate(guildId, key, path, index, value) {
        const root = this._deepClone(this.getKey(guildId, key));
        return this.set(guildId, key, SettingsManager.setAtPath(root, [...path, String(index)], value));
    }

    /** Remove the item at `index` from the list at `path`. */
    listRemove(guildId, key, path, index) {
        const root = this._deepClone(this.getKey(guildId, key));
        const arr = SettingsManager.getAtPath(root, path);
        const list = Array.isArray(arr) ? arr.slice() : [];
        list.splice(index, 1);
        return this.set(guildId, key, SettingsManager.setAtPath(root, path, list));
    }

    /** Move the item at `index` one slot in `dir` (-1 up / +1 down). No-op at the bounds. */
    listMove(guildId, key, path, index, dir) {
        const root = this._deepClone(this.getKey(guildId, key));
        const arr = SettingsManager.getAtPath(root, path);
        const list = Array.isArray(arr) ? arr.slice() : [];
        const j = index + (dir < 0 ? -1 : 1);
        if (index < 0 || index >= list.length || j < 0 || j >= list.length) return list;
        [list[index], list[j]] = [list[j], list[index]];
        return this.set(guildId, key, SettingsManager.setAtPath(root, path, list));
    }

    /**
     * Append `value` to an array-typed (scalar-inner) key. Errors if the key
     * isn't an `array<…>` type. Duplicates are allowed unless caller filters.
     */
    add(guildId, key, value) {
        if (!String(this._schema[key]?.type).startsWith('array<'))
            throw new Error(`"${key}" is not an array setting.`);

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

    /** Remove `value` from an array-typed (scalar-inner) key. */
    remove(guildId, key, value) {
        if (!String(this._schema[key]?.type).startsWith('array<'))
            throw new Error(`"${key}" is not an array setting.`);

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
    reset(guildId, key) {
        if (!this.has(key)) throw new Error(`Unknown setting "${key}".`);

        const record = this.get(guildId);
        record.settings[key] = this._defaultFor(this._schema[key]);
        this._collection().update(record);
        this._cache.set(guildId, record);
        return record.settings[key];
    }

    /** Reset every key in this module to defaults. */
    factoryReset(guildId) {
        const record = this.get(guildId);
        record.settings = this.defaults();
        this._collection().update(record);
        this._cache.set(guildId, record);
        return record;
    }
};
