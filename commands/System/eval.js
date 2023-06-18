const { inspect } = require("util");
const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const Command = require("../../modules/Command");

module.exports = class EvalCommand extends Command {
    constructor() {
        super({
            name: "eval",
            description: "Evaluates albitrary JavaScript",
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

    async run(client, interaction, args, plugin) {
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
                const embed = new EmbedBuilder()
                    .setTitle('Eval - Output')
                    .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                    .setColor('Random')
                return interaction.reply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle('Eval - Output')
                .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                .setColor('Random')
            interaction.reply({ embeds: [embed] });

        } catch (err) {
            console.error(err);

            const error = err.toString().replace(client.token, 'mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0');
            const embed = new EmbedBuilder()
                .setTitle('Eval - Error')
                .setDescription(`\`\`\`js\n${error}\n\`\`\``)
                .setColor('ff1c1c')
            interaction.reply({ embeds: [embed] });
        }
    }
}