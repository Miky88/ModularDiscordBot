const DataManager = require("../DataManager");
const mongo = require("mongoose");

module.exports = class MongodbManager extends DataManager {
    constructor(options) {
        super(options);
        this.schemas = new Map();
        
        mongo.connect(options.uri, options.options);

        mongo.connection.on("connected", () => {
            this.logger.log("Database successfully connected");
        });

        mongo.connection.on("err", err => {
            this.logger.error(`Database connection error: `, err);
        });

        mongo.connection.on("disconnected", () => {
            this.logger.warn("Database connection lost");
        });

        for (const schema in options.schemas) {
            this.schemas.set(schema.name, mongo.model(schema.name, new mongo.Schema(schema)));
        }
    }
    
    async add(collectionName, obj) {
        const schema = this.schemas.get(collectionName);
        if (!schema)
            return false;
        
        await new schema(obj).save();     
        return true;
    }

    async get(collectionName, obj) {
        const schema = this.schemas.get(collectionName);
        if (!schema)
            return null;

        return await schema.findOne(obj);
    }

    async find(collectionName, query) {
        const schema = this.schemas.get(collectionName);
        if (!schema)
            return null;

        return await schema.find(query);
    }

    async update(collectionName, obj) {
        const schema = this.schemas.get(collectionName);
        if (!schema)
            return false;

        await schema.findOne(obj.query).then(async data => await data.updateOne(obj.data));
        return true;
    }

    async delete(collectionName, obj) {
        const schema = this.schemas.get(collectionName);
        if (!schema)
            return false;

        await schema.deleteOne(obj);
        return true;
    }

    async init(options) { // TODO
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