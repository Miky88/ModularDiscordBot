const Loki = require('lokijs');
const BotClient = require('..');
const Logger = require('./Logger.js');
const PowerLevels = require('./PowerLevels.js');
const cache = new Map();

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
    
    /**
     * @param {String} userID 
     */
    async addUser(userID) {
        const user = await this.db.users.insert({
            id: userID,
            powerlevel: PowerLevels.USER,
            language: null
        })
        this.cacheUser(user)
        return user;
    }

    /**
     * @param {import('discord.js').User} user 
     */
    cacheUser(user) {
        cache.set(user.id, user)
    }

    /**
     * @param {String} userID 
     */
    getUser(userID) {
        const data = cache.get(userID) || this.db.users.findOne({ id: userID })
        if (data) this.cacheUser(data)
        return data
    }
    
    /**
     * @param {String} userID 
     */
    async forceUser(userID) {
        let user = await this.getUser(userID)
        if (user) {
            if(user.powerlevel !== PowerLevels.OWNER && this.client.config.get('owners').includes(userID)) {
                user.powerlevel = PowerLevels.OWNER
                this.updateUser(user)
            } else if (user.powerlevel === PowerLevels.OWNER && !this.client.config.get('owners').includes(userID)) {
                user.powerlevel = PowerLevels.USER
                this.updateUser(user)
            }
            return user;
        }
        return await this.addUser(userID)
    }

    /**
     * @param {*} data 
     */
    async updateUser(data) {
        delete data.user
        this.db.users.update(data)

        const update = await this.db.users.findOne({ id: data.id })
        this.cacheUser(update)
        return update
    }

    /**
     * @param {import('lokijs').Collection} collection 
     */
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
