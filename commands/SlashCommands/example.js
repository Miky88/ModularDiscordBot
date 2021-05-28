/**
 * @param {import("discord.js").Client & { commands: Map, PluginManager: import("../modules/PluginManager") }} client
 * @param {import("discord.js").CommandInteraction} interaction
 */
exports.run = async (client, interaction, args) => {
    interaction.reply(args["input"], {ephemeral: true})
};

exports.config = {
    minLevel: 0,
    reqPerms: [],
    botPerms: [],
    data: {
        name: "example",
        description: "This is an example command",
        options: [{
          name: 'input',
          type: 'STRING',
          description: 'The input which should be echoed back',
          required: true,
        }]
    }
};