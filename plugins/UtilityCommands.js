const BasePlugin = require("../modules/BasePlugin.js");

class UtilityCommands extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "UtilityCommands",
            info: "Manages the Utility commands",
            enabled: true
        })
    }
}

module.exports = UtilityCommands;