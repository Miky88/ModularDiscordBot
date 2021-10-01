const { inspect } = require("util");
const { MessageEmbed } = require("discord.js");
const BaseCommand = require("../../modules/BaseCommand");

module.exports = class EvalCommand extends BaseCommand {
    constructor() {
        super({
            name: ":computer:eval",
            info: "Evaluates albitrary JavaScript",
            usage: "[code]",
            aliases: ["ev", "js"],
            cooldown: 3,
            minLevel: 10,
            args: [
                {
                    name: "code",
                    type: "string"
                }
            ]
        })
    }

    async run(client, message, args, plugin) {
        const content = args.code.replace(/client\.token/gmi, '\'mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0\'');

        try {
            let result = await eval(content);
            if (typeof result !== 'string') {
                result = inspect(result, {
                    depth: 0,
                });
            }

            if (result.includes(client.token)) result = `${result}`.split(client.token).join('mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0');

            if (result.length > 2048) {
                this.log(result);
                result = 'Too long to be printed (content got console logged)';
                const embed = new MessageEmbed()
                    .setTitle('Eval - Output')
                    .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                    .setColor('RANDOM')
                return message.channel.send({ embeds: [embed] });
            }

            const embed = new MessageEmbed()
                .setTitle('Eval - Output')
                .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                .setColor('RANDOM')
            message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);

            const error = err.toString().replace(client.token, 'mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0');
            const embed = new MessageEmbed()
                .setTitle('Eval - Error')
                .setDescription(`\`\`\`js\n${error}\n\`\`\``)
                .setColor('ff1c1c')
            message.channel.send({ embeds: [embed] });
        }
    }
}