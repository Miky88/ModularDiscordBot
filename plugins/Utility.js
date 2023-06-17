const BasePlugin = require("../modules/BasePlugin.js");

module.exports = class Utility extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true
        })
    }
}