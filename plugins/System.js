const BasePlugin = require("../modules/BasePlugin.js");

module.exports = class System extends BasePlugin {
    constructor(client) {
        super(client, {
            info: "Loads the system utility commands",
            enabled: true
        })
    }
}