const Logger = require('./Logger.js');
const PowerLevels = require('./PowerLevels.js');
const { PermissionsBitField } = require('discord.js');

/** Deep clone a plain (JSON-shaped) record; used for snapshot-and-replace updates. */
const clone = typeof structuredClone === 'function'
    ? structuredClone
    : (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Default level ladder seeded into every guild on first read. The `builtin`
 * tag is informational only (the UI marks which levels shipped by default vs
 * which were admin-created); admins can rename, reweight, and delete any
 * level they want. There is no auto-backfill once a guild record exists.
 */
const BUILTIN_LEVELS = Object.freeze([
    { id: 'member',    name: 'Member',    weight: 0,  builtin: true, roles: [] },
    { id: 'helper',    name: 'Helper',    weight: 1,  builtin: true, roles: [] },
    { id: 'moderator', name: 'Moderator', weight: 5,  builtin: true, roles: [] },
    { id: 'admin',     name: 'Admin',     weight: 10, builtin: true, roles: [] }
]);

/**
 * Per-guild custom level / role-permission system.
 *
 * Levels are admin-editable: rename, reweight, add custom levels, bind roles.
 * Built-in level IDs (member/helper/moderator/admin) are immutable so module
 * gates referencing them never dangle. Modules declare `requires: 'moderator'`
 * (a level ID) on commands and per setting keys; this manager evaluates the
 * requirement at runtime against the member's roles in the current guild.
 *
 * Resolver order (granted on first hit):
 *   1. Bot OWNER PowerLevel  (global escape hatch from /setlevel)
 *   2. Guild owner
 *   3. Discord Administrator native permission
 *   4. Member's effective weight (max over bound role weights and userOverride)
 *      ≥ required level's weight
 */
module.exports = class PermissionsManager {
    /**
     * @param {import('..')} client
     */
    constructor(client) {
        this.client = client;
        this.logger = new Logger('Permissions');
        this.handle = client.database.register('Permissions', { collections: ['guilds'] });
    }

    static get BUILTIN_LEVELS() { return BUILTIN_LEVELS; }

    _collection() { return this.handle.collection('guilds'); }

    /**
     * Get the full permission config for a guild, seeding builtin defaults the
     * first time it's accessed.
     * @param {string} guildId
     * @returns {object}
     */
    getConfig(guildId) {
        const col = this._collection();
        let record = col.findOne({ id: guildId });
        if (!record) {
            record = col.insert({
                id: guildId,
                levels: BUILTIN_LEVELS.map(l => ({ ...l, roles: [] })),
                userOverrides: {},
                commandOverrides: {},
                settingOverrides: {}
            });
        }
        return record;
    }

    _save(record) {
        this._collection().update(record);
        return record;
    }

    /**
     * Apply a mutation atomically. Clones the guild config, runs `fn` against
     * the clone, then commits it in a single `update()`. If `fn` throws, the
     * stored record is left untouched — snapshot-and-replace, never a partial
     * in-place mutation, and `update()` is the one explicit commit point (Loki
     * doesn't observe direct property mutations).
     * @param {string} guildId
     * @param {(draft: object) => void} fn
     * @returns {object} The committed config.
     */
    _mutate(guildId, fn) {
        const draft = clone(this.getConfig(guildId));
        fn(draft);
        return this._save(draft);
    }

    /**
     * Look up a level definition in a guild by ID.
     * @returns {{id:string,name:string,weight:number,builtin?:boolean,roles:string[]} | null}
     */
    getLevel(guildId, levelId) {
        const cfg = this.getConfig(guildId);
        return cfg.levels.find(l => l.id === levelId) || null;
    }

    /**
     * Create or update a level. For builtin levels only `name`, `weight`, and
     * `roles` may be changed; the `id` and `builtin` flag are immutable.
     * @param {string} guildId
     * @param {object} level
     * @param {string} level.id
     * @param {string} [level.name]
     * @param {number} [level.weight]
     * @param {string[]} [level.roles]
     * @returns {object} The saved level.
     */
    setLevel(guildId, level) {
        if (!level || !level.id) throw new Error('Level must have an id.');
        const cfg = this._mutate(guildId, draft => {
            const existing = draft.levels.find(l => l.id === level.id);
            if (existing) {
                if (typeof level.name === 'string') existing.name = level.name;
                if (typeof level.weight === 'number') existing.weight = level.weight;
                if (Array.isArray(level.roles)) existing.roles = [...new Set(level.roles)];
            } else {
                draft.levels.push({
                    id: level.id,
                    name: level.name || level.id,
                    weight: typeof level.weight === 'number' ? level.weight : 0,
                    builtin: false,
                    roles: Array.isArray(level.roles) ? [...new Set(level.roles)] : []
                });
            }
        });
        return cfg.levels.find(l => l.id === level.id);
    }

    /**
     * Delete a level (built-in or custom). Strips any overrides referencing it
     * so they don't dangle as orphans.
     * @returns {boolean} true if deleted.
     */
    deleteLevel(guildId, levelId) {
        if (!this.getLevel(guildId, levelId)) return false;
        this._mutate(guildId, draft => {
            draft.levels = draft.levels.filter(l => l.id !== levelId);
            // Strip references in overrides (orphan IDs would silently deny).
            for (const [uid, lid] of Object.entries(draft.userOverrides))
                if (lid === levelId) delete draft.userOverrides[uid];
            for (const [cmd, lid] of Object.entries(draft.commandOverrides))
                if (lid === levelId) delete draft.commandOverrides[cmd];
            for (const [k, lid] of Object.entries(draft.settingOverrides))
                if (lid === levelId) delete draft.settingOverrides[k];
        });
        return true;
    }

    /**
     * Add a role to a level (idempotent). A role can belong to multiple levels;
     * the resolver takes max weight across all matching bindings.
     */
    bindRole(guildId, levelId, roleId) {
        return this._mutate(guildId, draft => {
            const level = draft.levels.find(l => l.id === levelId);
            if (!level) throw new Error(`Unknown level "${levelId}".`);
            if (!level.roles.includes(roleId)) level.roles.push(roleId);
        }).levels.find(l => l.id === levelId);
    }

    unbindRole(guildId, levelId, roleId) {
        return this._mutate(guildId, draft => {
            const level = draft.levels.find(l => l.id === levelId);
            if (!level) throw new Error(`Unknown level "${levelId}".`);
            level.roles = level.roles.filter(r => r !== roleId);
        }).levels.find(l => l.id === levelId);
    }

    setUserOverride(guildId, userId, levelId) {
        return this._mutate(guildId, draft => {
            if (levelId == null) delete draft.userOverrides[userId];
            else {
                if (!draft.levels.find(l => l.id === levelId))
                    throw new Error(`Unknown level "${levelId}".`);
                draft.userOverrides[userId] = levelId;
            }
        }).userOverrides;
    }

    setCommandOverride(guildId, commandName, levelId) {
        return this._mutate(guildId, draft => {
            if (levelId == null) delete draft.commandOverrides[commandName];
            else {
                if (!draft.levels.find(l => l.id === levelId))
                    throw new Error(`Unknown level "${levelId}".`);
                draft.commandOverrides[commandName] = levelId;
            }
        }).commandOverrides;
    }

    setSettingOverride(guildId, settingKey, levelId) {
        return this._mutate(guildId, draft => {
            if (levelId == null) delete draft.settingOverrides[settingKey];
            else {
                if (!draft.levels.find(l => l.id === levelId))
                    throw new Error(`Unknown level "${levelId}".`);
                draft.settingOverrides[settingKey] = levelId;
            }
        }).settingOverrides;
    }

    /**
     * Compute the member's effective level in their guild from role bindings
     * and userOverride. Returns the level object or null if no binding matches.
     * @param {import('discord.js').GuildMember} member
     */
    effectiveLevel(member) {
        if (!member?.guild) return null;
        const cfg = this.getConfig(member.guild.id);

        const override = cfg.userOverrides[member.id];
        if (override) {
            const lvl = cfg.levels.find(l => l.id === override);
            if (lvl) return lvl;
        }

        const memberRoleIds = new Set(member.roles?.cache?.keys?.() || []);
        let best = null;
        for (const level of cfg.levels) {
            if (level.roles.some(r => memberRoleIds.has(r))) {
                if (!best || level.weight > best.weight) best = level;
            }
        }
        return best;
    }

    /**
     * Override-driven authorization for a command or setting key. Returns true
     * when no admin-set override applies — modules don't ship gates of their
     * own; they rely on Discord-native `defaultMemberPermissions` (for
     * commands) or the gating of the surrounding command (for settings).
     *
     * @param {import('discord.js').GuildMember} member
     * @param {object} target
     * @param {string} [target.commandName] Slash command name to check `commandOverrides[]` for.
     * @param {string} [target.settingKey]  `Module.key` to check `settingOverrides[]` for.
     */
    check(member, target = {}) {
        if (!member?.guild) return false;

        // 1. Bot OWNER escape hatch.
        const userData = this.client.database.getUser?.(member.id);
        if (userData?.powerlevel === PowerLevels.OWNER) return true;

        // 2. Guild owner.
        if (member.guild.ownerId === member.id) return true;

        // 3. Discord Administrator perm.
        if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;

        // 4. Resolve admin-set override for this target.
        const cfg = this.getConfig(member.guild.id);
        let requiredLevelId = null;
        if (target.commandName && cfg.commandOverrides[target.commandName])
            requiredLevelId = cfg.commandOverrides[target.commandName];
        if (target.settingKey && cfg.settingOverrides[target.settingKey])
            requiredLevelId = cfg.settingOverrides[target.settingKey];

        // No override set → no custom-level gate; defer to Discord-native /
        // surrounding-command authorization that already let the call through.
        if (!requiredLevelId) return true;

        const requiredLevel = cfg.levels.find(l => l.id === requiredLevelId);
        if (!requiredLevel) {
            this.logger.warn(`Guild ${member.guild.id} references unknown level "${requiredLevelId}" — denying.`);
            return false;
        }

        const effective = this.effectiveLevel(member);
        if (!effective) return requiredLevel.weight === 0;
        return effective.weight >= requiredLevel.weight;
    }
};
