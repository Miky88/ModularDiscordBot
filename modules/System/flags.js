const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType, EmbedBuilder, userMention, User, UserContextMenuCommandInteraction } = require('discord.js');

module.exports = class FlagsCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'flags',
            description: 'Edit user flags',
            requiredFlag: ['OWNER'],
            options: [
                {
                    name: "list",
                    description: "List the flags of an user",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "User to perform action on",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        }
                    ]
                },
                {
                    name: "add",
                    description: "Add a flag to an user",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "User to perform action on",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "flag",
                            description: "Flag to add",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: ["BLACKLISTED", "STAFF", "PREMIUM"].map(c => ({ name: c, value: c }))
                        }
                    ]
                },
                {
                    name: "remove",
                    description: "Remove a flag to an user",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "User to perform action on",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "flag",
                            description: "Flag to remove",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: ["BLACKLISTED", "STAFF", "PREMIUM"].map(c => ({ name: c, value: c }))
                        }
                    ]
                }
            ]
        });
        this.flagStrings = {
            owner: "**Bot Owner**: This user is a owner of this bot.\n",
            staff: "**Bot Staffer**: This user is a staffer of this bot. You can talk to him for support.\n",
            premium: "**Premium**: This user is premium on this bot and supported the development.\n",
            blacklisted: "**Blacklisted**: This user is blacklisted from this bot. You shouldn't talk to him.\n",
            user: "**User**: A normal user of this bot.\n"
        },
        this.embedSettings = {
            list: {
                title: "**Flags of <user>**:"
            }
        }
    }

    /**
     * 
     * @param {import('../..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        switch (interaction.options.getSubcommand()) {
            case "list":
                let flagStrings = "";
                let flags = client.database.getFlags(args.user);
                if (flags.includes("OWNER")) {
                    flagStrings += this.flagStrings.owner.toString();
                }
                if (flags.includes("STAFF")) {
                    flagStrings += this.flagStrings.staff.toString();
                }
                if (flags.includes("PREMIUM")) {
                    flagStrings += this.flagStrings.premium.toString();
                }
                if (flags.includes("BLACKLISTED")) {
                    flagStrings += this.flagStrings.blacklisted.toString();
                }
                if (flags.includes("USER")) {
                    flagStrings += this.flagStrings.user.toString();
                }
                const embed = new EmbedBuilder()
                    .setTitle(this.embedSettings.list.title.replace('<user>', interaction.user.tag))
                    .setDescription(flagStrings)
                    .setColor('Random');
                interaction.reply({embeds: [embed]});
                break;
            case "add":
                break;
            case "remove":
                break;
        }
        
    }
}