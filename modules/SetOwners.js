const Module = require("../structures/Module.js");

module.exports = class SetOwners extends Module {
    constructor(client) {
        super(client, {
            name: "SetOwners",
            enabled: true,
            events: ["ready"]
        })
    }

    /**
     * @param {import('discord.js').Client} client 
     * @param  {...any} _args 
     */
    async run(client, ..._args) {
        for (const owner of this.client.config.get('owners')){
            if(this.client.database.getUser(owner) == null)
                await this.client.database.addUser(owner)
            if(!this.client.database.hasFlag(owner, 'OWNER'))
                await this.client.database.forceUser(owner)
        }
    }
}