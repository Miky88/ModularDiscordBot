const Module = require("../structures/Module.js");
const ModulePriorities = require("../structures/ModulePriorities.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true,
        })
    }
}