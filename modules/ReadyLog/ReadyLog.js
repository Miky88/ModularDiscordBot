const Module = require("@core/Module.js");

module.exports = class ReadyLog extends Module {
    constructor(client) {
        super(client, {
            name: "ReadyLog",
            info: "Logs informations once ready and sets the custom status",
            events: ["clientReady"]
        })
    }

    /**
     * @param {import('../../index.js')} client 
     * @param  {...any} _args 
     */
    async clientReady(client, ..._args) {
        // Log some useful variables when online
        this.logger.success("I am ready!");
        this.logger.info(`I am logged in as ${client.user.tag}`);
        this.logger.info(`Node version: ${process.version}`);
        this.logger.info(`Discord.JS version: ${require('discord.js').version}`);
        this.logger.info("Invite: https://discordapp.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=8&scope=bot");
        this.logger.info(`System Server: ${client.config.get('systemServer').join(", ")}`);
        this.logger.info(`Owners: ${client.config.get('owners').join(", ")}`);
        this.logger.info(`===========================`);
    }
}
