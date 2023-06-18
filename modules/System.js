const Plugin = require("../structures/Plugin.js");

module.exports = class System extends Plugin {
    constructor(client) {
        super(client, {
            info: "Loads the system utility commands",
            enabled: true
        })
    }
}