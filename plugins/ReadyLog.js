const BasePlugin = require("../modules/BasePlugin.js");

module.exports = class ReadyLog extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "ReadyLog",
            info: "Logs informations once ready and sets the custom status",
            enabled: true,
            event: "ready",
            system: true
        })
    }

    /**
     * @param {import('discord.js').Client} client 
     * @param  {...any} _args 
     */
    async run(client, ..._args) {
        // Log some useful variables when online
        this.log("I am ready!");
        this.log(`I am logged in as ${client.user.tag}`);
        this.log(`Node version: ${process.version}`);
        this.log(`Discord.JS version: ${require('discord.js').version}`);
        this.log("Invite: https://discordapp.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=8&scope=bot");
        this.log(`===========================`);
        client.user.setActivity(client.config.activity);

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