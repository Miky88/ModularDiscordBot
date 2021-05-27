exports.run = async (client, interaction, args) => {
    interaction.reply(args["input"])
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