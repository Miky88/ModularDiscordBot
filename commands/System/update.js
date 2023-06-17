const BotClient = require("../..");
const Command = require("../../modules/Command");

module.exports = class ExecCommand extends Command {
    constructor() {
        super({
            name: "update",
            description: "Pulls commits from git and reboots the bot",
            cooldown: 3,
            minLevel: 10,
        })
    }

    /**
     * @param {BotClient} client
     */
    async run(client, message, args) {
        const [exec] = client.pluginManager.getCommand("exec");
        if (!exec)
            return message.reply("Unknown command `exec`, aborting.");

        await exec.run(client, message, { code: "git pull --no-rebase" });

        const [reboot] = client.pluginManager.getCommand("reboot");
        if (!reboot)
            return message.reply("Unknown command `reboot`, aborting.");

        await reboot.run(client, message, {});
    }
}