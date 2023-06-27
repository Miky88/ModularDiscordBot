const Logger = require("./Logger");

// SQL, Redis, lokijs
module.exports = class DataManager {
    constructor(options) {
        this.logger = new Logger(this.constructor.name);
    }
}