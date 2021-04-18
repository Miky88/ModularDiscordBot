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
    addUser: async (userID) => {
        const user = await db.users.insert({
            id: userID,
            powerlevel: 0,
            blacklistReason: null
        })
        await this.cacheUser(user)
        return user;
    },

    cacheUser: (user) => {
        cache.set(user.id, user)
        return true;
    },

    getUser: async (userID) => {
        const data = cache.get(userID) || db.users.findOne({ id: userID })
        if (data) await cacheUser(data)
        return data
    },

    forceUser: async (userID) => {
        const user = await getUser(userID)
        if (user) return user
        return await addUser(user)
    },

    updateUser: async (data) => {
        delete data.user
        db.users.update(data)

        const update = await db.users.findOne({id: data.id})
        await cacheUser(update)
        return update
    },

    _raw: db
}