const Module = require("../structures/Module.js");

module.exports = class System extends Module {
    constructor(client) {
        super(client, {
            info: "Loads the system utility commands",
            enabled: true
        })
    }
}