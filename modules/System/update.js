const Command = require("../../structures/Command.js");
const PowerLevels = require("../../structures/PowerLevels.js");

module.exports = class UpdateCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: "update",
            description: "Pulls commits from git and reboots the bot",
            cooldown: 3,
            minLevel: PowerLevels.OWNER
        })
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        const [exec] = client.moduleManager.getCommand("exec");
        if (!exec)
            return interaction.reply("Unknown command `exec`, aborting.");

        await exec.run(client, interaction, { code: "git pull --no-rebase" });

        const [reboot] = client.moduleManager.getCommand("reboot");
        if (!reboot)
            return interaction.reply("Unknown command `reboot`, aborting.");

        await reboot.run(client, interaction, {});
    }
}
