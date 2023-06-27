const { AttachmentBuilder, ApplicationCommandOptionType } = require("discord.js");
const exec = require("util").promisify(require("child_process").exec);
const Command = require("../../structures/Command.js");

module.exports = class ExecCommand extends Command {
    constructor() {
        super({
            name: "exec",
            description: "Runs shell commands on the host machine",
            cooldown: 3,
            minLevel: 10,
            options: [
                {
                    name: "code",
                    description: "Code to execute",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                }
            ]
        })
    }

    async run(client, interaction, args, module) {
        let script = args.code

        try {
            let result = await exec(script).catch(err => {
                throw err;
            });

            let output = result.stdout ? "```sh\n" + result.stdout + "```" : "";
            let outerr = result.stderr ? "```sh\n" + result.stderr + "```" : "";

            if (output.includes(client.config.token))
                output = output.replace(
                    this.client.token,
                    '"If someone tried to make you output the token, you were likely being scammed."'
                );
            if (outerr.includes(client.config.token))
                outerr = outerr.replace(
                    this.client.token,
                    '"If someone tried to make you output the token, you were likely being scammed."'
                );

            if (output.length > 1990) {
                return await interaction.reply({ attachments: [
                    new AttachmentBuilder(Buffer.from(output), {name: "output.txt"})
                ]});
            }
            if (outerr.length > 1990) {
                return await interaction.reply({ attachments: [
                    new AttachmentBuilder(Buffer.from(outerr), {name: "outerr.txt"})
                ]});
            }

            await interaction.reply(!!outerr ? outerr : output);
        } catch (err) {
            this.logger.error(err);

            let error = err
                .toString()
                .replace(
                    client.config.token,
                    '"If someone tried to make you output the token, you were likely being scammed."'
                );
            return await interaction.reply(error, { code: "bash" });
        }
    }
}