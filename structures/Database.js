const Loki = require('lokijs');
const BotClient = require('..');
const Logger = require('./Logger.js');
const cache = new Map();

const flags = {
    OWNER: 1 << 0,
    STAFF: 1 << 1,
    PREMIUM: 1 << 2,
    BLACKLISTED: 1 << 3,
};

module.exports = class Database {
    /**
     * The bot's main database
     * @param {BotClient} client 
     */
    constructor(client) {
        this.client = client;
        this.collections = ['users']

        this.db = new Loki('database.db', {
            autoload: true,
            autosave: true,
            autoloadCallback: () => this.collections.forEach((collection) => this.db[collection] = this.db.addCollection(collection)),
            autosaveInterval: 1000,
        });
        this.logger = new Logger('DB');

        // console.log(this.db.listCollections())
        this.logger.verbose('Database loaded')
    }
    
    reconfigure() {
        this.db.configureOptions({
            autoload: true,
            autosave: true,
            autoloadCallback: () => this.collections.forEach((collection) => this.db[collection] = this.db.addCollection(collection)),
            autosaveInterval: 1000, 
        })
    }

    async addUser(userID) {
        const user = await this.db.users.insert({
            id: userID,
            flags: 0
        })
        this.cacheUser(user)
        return user;
    }

    cacheUser(user) {
        cache.set(user.id, user)
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
        user.flags = user.flags ? parseInt(user.flags) : 0;
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
        user.flags = user.flags ? parseInt(user.flags) : 0;
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
            } else if (!this.client.config.get('owners').includes(user.id) && this.hasFlag(user.id, 'OWNER')) {
                this.setFlag(user.id, 'OWNER', false);
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

    fixCollection (collection) {
        this.logger.debug('Fixing collection', collection.name);
        const deduplicateSet = new Set();
        const data = collection.data
            .sort((a, b) => a.meta.created - b.meta.created)
            .filter((x) => {
                const duplicated = deduplicateSet.has(x.$loki);
                deduplicateSet.add(x.$loki);

                if (duplicated) {
                    this.logger.warn('Detected duplicated key, will remove it');
                }
                return !duplicated;
            })
            .sort((a, b) => a.$loki - b.$loki);

        const index = new Array(data.length);
        for (let i = 0; i < data.length; i += 1) {
            index[i] = data[i].$loki;
        }

        collection.data = data;
        collection.idIndex = index;
        collection.maxId = collection.data?.length
            ? Math.max(...collection.data.map((x) => x.$loki))
            : 0;
        collection.dirty = true;
        collection.checkAllIndexes({
            randomSampling: true,
            repair: true,
        });
        this.logger.success('Done!');
    }
}