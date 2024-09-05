const Module = require("../structures/Module.js");

module.exports = class ReadyLog extends Module {
    constructor(client) {
        super(client, {
            info: "Logs informations once ready and sets the custom status",
            enabled: true,
            event: "ready"
        })
    }

    /**
     * @param {import('discord.js').Client} client 
     * @param  {...any} _args 
     */
    async run(client, ..._args) {
        // Log some useful variables when online
        this.logger.success("I am ready!");
        this.logger.info(`I am logged in as ${client.user.tag}`);
        this.logger.info(`Node version: ${process.version}`);
        this.logger.info(`Discord.JS version: ${require('discord.js').version}`);
        this.logger.info("Invite: https://discordapp.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=8&scope=bot");
        this.logger.info(`System Server: ${client.config.get('systemServer').join(", ")}`);
        this.logger.info(`Owners: ${client.config.get('owners').join(", ")}`);
        this.logger.info(`===========================`);

        // If the bot got rebooted with reboot command, this will edit the message once ready
        try {
            const { id, channel } = require("./../reboot.json");
            let c = client.channels.cache.get(channel);
            await c.messages.fetch();
            let m = c.messages.cache.get(id);
            await m.edit(":white_check_mark: Rebooted. It took " + ((Date.now() - m.createdTimestamp) / 1000).toFixed(1) + "ms");
            fs.unlink("./reboot.json", () => { });
        } catch (e) {
            // pass
        }
    }
}