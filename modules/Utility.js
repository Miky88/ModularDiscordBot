const Module = require("../structures/Module.js");
const ModulePriorities = require("../structures/ModulePriorities.js");

module.exports = class Utility extends Module {
    constructor(client) {
        super(client, {
            name: "Utility",
            info: "Loads the utility commands",
            enabled: true,
            // settings: {
            //     kkkg: ["kofekof", "fmkf"],
            //     fkopwefjk: "kfoekfe",
            //     kfoefke: 10,
            //     kefoem: 2.4
            // }
        })
    }
}