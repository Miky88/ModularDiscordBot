const { MessageAttachment } = require("discord.js");
const exec = require("util").promisify(require("child_process").exec);
const BaseCommand = require("../../modules/BaseCommand");

module.exports = class ExecCommand extends BaseCommand {
    constructor() {
        super({
            name: ":floppy_disk:exec",
            info: "Runs shell commands on the host machine",
            usage: "[code]",
            cooldown: 3, // Command cooldown
            minLevel: 10, // Minimum level require to execute the command
            args: [
                {
                    name: "code",
                    type: "string"
                }
            ]
        })
    }

    async run(client, message, args) {
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
                return message.channel.send(
                    new MessageAttachment(Buffer.from(output), "output.txt")
                );
            }
            if (outerr.length > 1990) {
                return message.channel.send(
                    new MessageAttachment(Buffer.from(outerr), "outerr.txt")
                );
            }

            message.channel.send(!!outerr ? outerr : output);
        } catch (err) {
            console.error(err);

            let error = err
                .toString()
                .replace(
                    client.config.token,
                    '"If someone tried to make you output the token, you were likely being scammed."'
                );
            return message.channel.send(error, { code: "bash" });
        }
    }
}