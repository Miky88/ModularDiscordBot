const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType } = require('discord.js');

module.exports = class FlagsCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'flags',
            description: 'Edit user flags',
            requiredFlag: ['OWNER'],
            options: [
                {
                    name: "action",
                    description: "Action to perform",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: ["add", "remove", "list"].map(c => ({ name: c, value: c }))
                },
                {
                    name: "user",
                    description: "User to perform action on",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "flag",
                    description: "Flag to add/remove",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: ["BLACKLISTED", "STAFF", "PREMIUM"].map(c => ({ name: c, value: c }))
                }
            ]
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        let { action, user, flag } = args;

        
    }
}