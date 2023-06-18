const Module = require("../structures/Module.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            info: "Loads the utility commands",
            enabled: true
        })
    }
}