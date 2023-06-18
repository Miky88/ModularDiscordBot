const BasePlugin = require("../modules/BasePlugin.js");

module.exports = class Utility extends BasePlugin {
    constructor(client) {
        super(client, {
            info: "Loads the utility commands",
            enabled: true
        })
    }
}