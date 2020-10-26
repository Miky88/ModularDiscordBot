const BasePlugin = require("../base/BasePlugin.js");

class ReadyLog extends BasePlugin {
    constructor() {
        super({
            name: "ReadyLog", // Name of the plugin
            info: "Logs informations once ready and sets the custom status", // 
            enabled: true, // Defines if this plugin would be enabled on startup
            event: "ready" // Event that triggeres the plugin
        })
    }

    async run(client, ...args) { // args are the arguments of Discord.js Events (es. for presenceUpdate you would have [oldPresence, newPresence])

        console.log("I am ready!");
        console.log(`I am logged in as ${client.user.tag}`);
        console.log(`Node version: ${process.version}`);
        console.log(`Discord.JS version: ${require('discord.js').version}`);
        console.log("Invite: https://discordapp.com/oauth2/authorize?client_id=" + client.user.id + "&permissions=8&scope=bot");
        console.log(`===========================`);
        client.user.setActivity(client.config.activity);

    }
}

module.exports = ReadyLog;