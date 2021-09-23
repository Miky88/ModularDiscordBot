const loki = require('lokijs');
const BotClient = require('..');
const cache = new Map();

module.exports = class Database {
    /**
     * @param {BotClient} client 
     */
    constructor(client) {
        this.client = client;
        this.collections = ['users'];

        for (let plugin of client.PluginManager.plugins.values()) {
            if (plugin.conf.usesDB)
                this.collections.push(`plugin_${plugin.about.name}`)
        }

        this.db = new loki('database.db', {
            autoload: true,
            autosave: true,
            autoloadCallback: () => this.collections.forEach(x => this.db[x] = this.db.addCollection(x)),
            autosaveInterval: 1000
        });
    }

    async addUser(userID) {
        const user = await this.db.users.insert({
            id: userID,
            powerlevel: this.client.config.owners.includes(userID) ? 10 : 0,
            blacklistReason: null
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

    async forceUser(userID) {
        let user = await this.getUser(userID)
        if (user) {
            if (this.client.config.owners.includes(user.id) && user.powerlevel != 10) {
                user.powerlevel = 10;
                await this.updateUser(user);
            }
            else if (!this.client.config.owners.includes(user.id) && user.powerlevel == 10) {
                user.powerlevel = 0;
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