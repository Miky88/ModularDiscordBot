const Loki = require('lokijs');
const BotClient = require('..');
const cache = new Map();

const flags = {
    OWNER: 1n << 0n,
    STAFF: 1n << 1n,
    PREMIUM: 1n << 2n,
    BLACKLISTED: 1n << 3n,
};

module.exports = class Database {
    /**
     * The bot's main database
     * @param {BotClient} client 
     */
    constructor(client) {
        this.client = client;
        this.collections = ['users', 'settings'];

        for (let module of client.moduleManager.modules.values()) {
           if (module.options.usesDB)
                this.collections.push(`plugin_${module.options.name}`)
        }

        this.db = new Loki('database.db', {
            autoload: true,
            autosave: true,
            autoloadCallback: () => this.collections.forEach(x => this.db[x] = this.db.addCollection(x)),
            autosaveInterval: 1000
        });
    }

    async addUser(userID) {
        const user = await this.db.users.insert({
            id: userID,
            flags: 0n,
            guildlevel: 0,
            blacklistReason: null,
            guildBlacklistReason: null
        })
        this.cacheUser(user)
        return user;
    }

    cacheUser(user) {
        cache.set(user.id, user)
        return true;
    }

    getUser(userID) {
        const data = cache.get(userID) || this.db.users.findOne({ id: userID })
        if (data) this.cacheUser(data)
        return data
    }
    
    setFlag(userId, flagName, value) {
        let flagValue = flags[flagName];
        if (!flagValue) throw new Error(`Invalid flag ${flagName}`);
        let user = this.getUser(userId);
        if (!user) throw new Error(`Invalid user ${userId}`);
        user.flags = user.flags ? BigInt(user.flags) : 0n;
        if (value) {
            user.flags |= flagValue;
        } else {
            user.flags &= ~flagValue;
        }
        return this.updateUser(user);
    }

    hasFlag(userId, flagName) {
        let flagValue = flags[flagName];
        if (!flagValue) throw new Error(`Invalid flag ${flagName}`);
        let user = this.getUser(userId);
        user.flags = user.flags ? BigInt(user.flags) : 0n;
        if (!user) throw new Error(`Invalid user ${userId}`);
        return (user.flags & flagValue) == flagValue;
    }

    getFlags(userId) {
        let user = this.getUser(userId);
        if (!user) throw new Error(`Invalid user ${userId}`);
        let userFlags = [];
        for (let flagName in flags) {
            if (this.hasFlag(userId, flagName)) userFlags.push(flagName);
        };
        return userFlags;
    }

    async forceUser(userID) {
        let user = await this.getUser(userID)
        if (user) {
            if (this.client.config.get('owners').includes(user.id) && !this.hasFlag(user.id, 'OWNER')) {
                this.setFlag(user.id, 'OWNER', true);
                await this.updateUser(user);
            } else if (!this.client.config.get('owners').includes(user.id) && this.hasFlag(user.id, 'OWNER')) {
                this.setFlag(user.id, 'OWNER', false);
                await this.updateUser(user);
            }
            return user;
        }
        return await this.addUser(userID)
    }

    async updateUser(data) {
        delete data.user
        this.db.users.update(data)

        const update = await this.db.users.findOne({ id: data.id })
        this.cacheUser(update)
        return update
    }
}