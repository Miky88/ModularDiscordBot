const loki = require('lokijs');
const cache = new Map(); // TradeMark

const collections = ['users']

let db = new loki('database.db', {
    autoload: true,
    autosave: true,
    autoloadCallback: () => collections.forEach(x => db[x] = db.addCollection(x)),
    autosaveInterval: 1000
})

module.exports = {
    addUser: async (id) => {
        const user = await db.users.insert({
            id: id,
            level: 0,
        })
        await this.cacheUser(user)
        return user;
    },

    cacheUser: async (user) => {
        cache.set(user.id, user)
        return true;
    },

    _raw: db
}