const { MessageAttachment } = require("discord.js");
const BotClient = require("../..");
const exec = require("util").promisify(require("child_process").exec);
const BaseCommand = require("../../modules/BaseCommand");

module.exports = class ExecCommand extends BaseCommand {
    constructor() {
        super({
            name: "update",
            info: "Aggiorna le modifiche e riavvia il bot",
            usage: "",
            cooldown: 3, // Command cooldown
            minLevel: 10, // Minimum level require to execute the command
            args: []
        })
    }

    /**
     * @param {BotClient} client
     */
    async run(client, message, args) {
        const [exec] = client.PluginManager.getCommand("exec");
        if (!exec)
            return message.reply("Non esiste il comando `exec`, impossibile continuare.");

        await exec.run(client, message, { code: "git pull --no-rebase" });

        const [reboot] = client.PluginManager.getCommand("reboot");
        if (!reboot)
            return message.reply("Non esiste il comando `reboot`, impossibile continuare.");

        await reboot.run(client, message, {});
    }
}