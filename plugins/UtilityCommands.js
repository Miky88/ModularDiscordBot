const BasePlugin = require("../modules/BasePlugin.js");

class UtilityCommands extends BasePlugin {
    constructor() {
        super({
            name: "UtilityCommands",
            info: "Manages the Utility commands",
            enabled: true
        })
    }

    async run(_client, ..._args) {
        // pass
    }
}

module.exports = UtilityCommands;