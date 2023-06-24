const DataManager = require("../DataManager");
const loki = require("lokijs");

module.exports = class LokiManager extends DataManager {
    constructor(options) {
        super(options);
        this.db = new loki('database.db', options);
    }
    
    async add(collectionName, obj) {
        const collection = this.db.getCollection(collectionName);
        if (!collection)
            return false;
        
        collection.insert(obj);
        this.db.saveDatabase();
        return true;
    }

    async get(collectionName, obj) {
        const collection = this.db.getCollection(collectionName);
        if (!collection)
            return null;

        // Check if obj is an ID or an object
        if (typeof obj === "string" || typeof obj === "number")
            return collection.get(obj);
        else
            return collection.findOne(obj);
    }

    async find(collectionName, query) {
        const collection = this.db.getCollection(collectionName);
        if (!collection)
            return null;

        return collection.find(query);
    }

    async update(collectionName, obj) {
        const collection = this.db.getCollection(collectionName);
        if (!collection)
            return false;

        collection.update(obj);
        return true;
    }

    async delete(collectionName, obj) {
        const collection = this.db.getCollection(collectionName);
        if (!collection)
            return false;

        collection.remove(obj);
        return true;
    }

    async init(options) {
        this.db.loadDatabase(options);
        return true;
    }

    async getCollection(collectionName) {
        return this.db.getCollection(collectionName);
    }

    async getCollections() {
        return this.db.listCollections();
    }

    async deleteDatabase() {
        return this.db.deleteDatabase();
    }

    async close() {
        return this.db.close();
    }
}