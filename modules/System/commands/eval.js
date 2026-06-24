const Command = require("@structures/Command.js");
const { ApplicationCommandOptionType } = require("discord.js");
const PowerLevels = require("@structures/PowerLevels.js");

module.exports = class EvalCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: "eval",
            description: "Evaluates arbitrary JavaScript",
            cooldown: 3,
            minLevel: PowerLevels.OWNER,
            options: [
                {
                    name: "code",
                    description: "Code to execute",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: "ephemeral",
                    description: "Reply only visible to you (default: true)",
                    type: ApplicationCommandOptionType.Boolean,
                    required: false,
                }
            ]
        });
    }

    /**
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {import('../System.js')} module
     */
    async run(client, interaction, module) {
        const code = interaction.options.getString("code");
        const ephemeral = interaction.options.getBoolean("ephemeral") ?? true;
        return module.evalUI.open(interaction, code, ephemeral);
    }
}
