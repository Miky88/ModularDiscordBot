const loki = require('lokijs');
const cache = new Map(); // TradeMark

module.exports = async (client) => {

    /**
     * @type {Loki & { users: UsersCollection }}
     */
    let db = new loki('database.db', {
        autoload: true,
        autosave: true,
        autoloadCallback: loadCollections,
        autosaveInterval: 1000
    })

    const collections = ['users']
    /**
     * @typedef {object} UsersCollectionData
     * 
     * User Data. sì.
     * 
     * @prop {string} id
     * @prop {string[]} banwaves
     * @prop {number} level
     * 
     * @prop {string} guildID
     * @prop {number} points
     * @prop {number} rank
     */

    /**
     * @typedef {Collection<UsersCollectionData>} UsersCollection
     */

    function loadCollections() {
        collections.forEach(x => {
            let coll = db.addCollection(x)

            db[x] = coll
        })
    }

    async function cacheUser(user) {
        cache.set(user.id, user);
    }

    async function addUser(id) {
        const user = await db.users.insert({
            id: id,
            banwaves: [],
            level: 0,
            guilds: []
        })
        await cacheUser(user)
        return user
    }
}