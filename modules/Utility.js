const Plugin = require("../structures/Plugin.js");

module.exports = class Utility extends Plugin {
    constructor(client) {
        super(client, {
            info: "Loads the utility commands",
            enabled: true
        })
    }
}