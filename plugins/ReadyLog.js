const BasePlugin = require("../modules/BasePlugin.js");

class ReadyLog extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "ReadyLog",
            info: "Logs informations once ready and sets the custom status",
            enabled: true,
            event: "ready",
            system: true
        })
    }

    async run(client, ..._args) {
        // Log some useful variables when online
        console.log("I am ready!");
        console.log(`I am logged in as ${client.user.tag}`);
        console.log(`Node version: ${process.version}`);
        console.log(`Discord.JS version: ${require('discord.js').version}`);
        console.log("Invite: https://discordapp.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=8&scope=bot");
        console.log(`===========================`);
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

module.exports = ReadyLog;