const BotClient = require("../..");
const Command = require("../../structures/Command.js");

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
    async run(client, interaction, args) {
        const [exec] = client.pluginManager.getCommand("exec");
        if (!exec)
            return interaction.reply("Unknown command `exec`, aborting.");

        await exec.run(client, interaction, { code: "git pull --no-rebase" });

        const [reboot] = client.pluginManager.getCommand("reboot");
        if (!reboot)
            return interaction.reply("Unknown command `reboot`, aborting.");

        await reboot.run(client, interaction, {});
    }
}