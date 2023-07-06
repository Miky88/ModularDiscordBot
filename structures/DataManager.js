const Logger = require("./Logger");

// SQL, Redis, lokijs
module.exports = class DataManager {
    constructor(options) {
        this.logger = new Logger(this.constructor.name);
    }

    /**
     * Adds an object to a collection
     * @param {*} collectionName 
     * @param {*} obj 
     * @returns {Boolean} Whether the operation was successful
     */
    async add(collectionName, obj) {
        throw new Error("Not implemented");
    }

    /**
     * Gets an object from a collection
     * @param {*} collectionName
     * @param {*} obj
     * @returns {*} The object from the collection, or null if it doesn't exist
     * @returns {Boolean} Whether the operation was successful
     */
    async get(collectionName, obj) {
        throw new Error("Not implemented");
    }

    /**
     * Finds objects in a collection
     * @param {*} collectionName
     * @param {*} query
     * @returns {*} The objects from the collection, or null if it doesn't exist
     */
    async find(collectionName, query) {
        throw new Error("Not implemented");
    }

    /**
     * Updates an object in a collection
     * @param {*} collectionName
     * @param {*} obj
     * @returns {Boolean} Whether the operation was successful
     */
    async update(collectionName, obj) {
        throw new Error("Not implemented");
    }

    /**
     * Deletes an object from a collection
     * @param {*} collectionName
     * @param {*} obj
     * @returns {Boolean} Whether the operation was successful
     */
    async delete(collectionName, obj) {
        throw new Error("Not implemented");
    }

    /**
     * Initializes the database
     * @param {*} options
     */
    async init(options) {
        throw new Error("Not implemented");
    }

    /**
     * Gets a collection
     * @param {*} collectionName
     * @returns {*} The collection
     */
    async getCollection(collectionName) {
        throw new Error("Not implemented");
    }

    /**
     * Gets all collections
     * @returns {*} All collections
     */
    async getCollections() {
        throw new Error("Not implemented");
    }

    /**
     * Deletes the database
     */
    async deleteDatabase() {
        throw new Error("Not implemented");
    }

    /**
     * Closes the connection to the database
     */
    async close() {
        throw new Error("Not implemented");
    }
}