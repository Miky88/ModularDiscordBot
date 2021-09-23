const BasePlugin = require("../modules/BasePlugin.js");

module.exports = class Utility extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Manages the Utility commands",
            enabled: true
        })
    }
}