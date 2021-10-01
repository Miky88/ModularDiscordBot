const { MessageAttachment } = require("discord.js");
const BotClient = require("../..");
const exec = require("util").promisify(require("child_process").exec);
const BaseCommand = require("../../modules/BaseCommand");

module.exports = class ExecCommand extends BaseCommand {
    constructor() {
        super({
            name: "update",
            info: "Pulls commits from git and reboots the bot",
            usage: "",
            cooldown: 3,
            minLevel: 10,
            args: []
        })
    }

    /**
     * @param {BotClient} client
     */
    async run(client, message, args) {
        const [exec] = client.PluginManager.getCommand("exec");
        if (!exec)
            return message.reply("Unknown command `exec`, aborting.");

        await exec.run(client, message, { code: "git pull --no-rebase" });

        const [reboot] = client.PluginManager.getCommand("reboot");
        if (!reboot)
            return message.reply("Unknown command `reboot`, aborting.");

        await reboot.run(client, message, {});
    }
}