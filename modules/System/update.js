const Command = require("../../structures/Command.js");
const PowerLevels = require("../../structures/PowerLevels.js");
const exec = require("util").promisify(require("child_process").exec);

module.exports = class UpdateCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: "update",
            description: "Pulls commits from git and reboots the bot",
            cooldown: 3,
            minLevel: PowerLevels.OWNER,
        })
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        try {
            let result = await exec("git pull --no-rebase").catch(err => {
                throw err;
            });

            let output = result.stdout ? "```sh\n" + result.stdout + "```" : "";
            let outerr = result.stderr ? "```sh\n" + result.stderr + "```" : "";

            await interaction.reply(!!outerr ? outerr : output);
        } catch (err) {
            this.logger.log(err);
            return await interaction.reply("```sh\n" + err + "```");
        }

        const [reboot] = client.moduleManager.getCommand("reboot");
        if (!reboot)
            return interaction.reply(await this.t('messages.noreboot', interaction));

        await reboot.run(client, interaction);
    }
}
