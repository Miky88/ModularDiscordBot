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
        this.embedSettings = {
            list: {
                title: "**Flags of <user>**:",
                flags: {
                    owner: "**Bot Owner**: This user is a owner of this bot.\n",
                    staff: "**Bot Staffer**: This user is a staffer of this bot. You can talk to him for support.\n",
                    premium: "**Premium**: This user is premium on this bot and supported the development.\n",
                    blacklisted: "**Blacklisted**: This user is blacklisted from this bot. You shouldn't talk to him.\n",
                    user: "**User**: A normal user of this bot.\n"
                }
            },
            add: {
                title: "**Added a flag to <user>:**",
                description: "Added the flag **<flag>** to <user>."
            },
            remove: {
                title: "**Removed a flag to <user>**",
                description: "Removed the flag **<flag>** to <user>"
            },
            errors: {
                alreadyHasFlag: {
                    title: "This user already has this flag."
                },
                notHasFlag: {
                    title: "This user doesn't have this flag."
                }
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
        let flags = client.database.getFlags(args.user);
        let flag = interaction.options.getString('flag');
        let user = interaction.user;
        let embed = new EmbedBuilder()
        switch (interaction.options.getSubcommand()) {
            case "list":
                let flagStrings = "";
                if (flags.includes("OWNER")) {
                    flagStrings += this.embedSettings.list.flags.owner;
                }
                if (flags.includes("STAFF")) {
                    flagStrings += this.embedSettings.list.flags.staff;
                }
                if (flags.includes("PREMIUM")) {
                    flagStrings += this.embedSettings.list.flags;
                }
                if (flags.includes("BLACKLISTED")) {
                    flagStrings += this.embedSettings.list.flags.blacklisted;
                }
                if (flags.includes("USER")) {
                    flagStrings += this.embedSettings.list.flags.user;
                }
                if( flagStrings == ""){
                    flagStrings += "None";
                }
                embed
                    .setTitle(this.embedSettings.list.title.replace('<user>', user.tag))
                    .setDescription(flagStrings)
                    .setColor('Random');
                interaction.reply({embeds: [embed]});
                break;
            case "add":
                console.log(flag)
                if(flags.includes(flag)){
                    embed
                        .setTitle(this.embedSettings.errors.alreadyHasFlag.title)
                        .setColor('Random');
                    interaction.reply({embeds: [embed]});
                    return;
                }
                client.database.setFlag(args.user, flag, true)

                embed
                    .setTitle(this.embedSettings.add.title.replace('<user>', user.tag))
                    .setDescription(this.embedSettings.add.description
                        .replace('<flag>', flag)
                        .replace('<user>', user.tag))
                    .setColor('Random');


                interaction.reply({embeds: [embed]});

                break;
            case "remove":
                console.log(flag)
                if(!(flags.includes(flag))){
                    embed
                        .setTitle(this.embedSettings.errors.notHasFlag.title)
                        .setColor('Random');
                    interaction.reply({embeds: [embed]});
                    return;
                }
                client.database.setFlag(args.user, flag, false);

                

                embed = new EmbedBuilder()
                    .setTitle(this.embedSettings.remove.title.replace('<user>', user.tag))
                    .setDescription(this.embedSettings.remove.description
                        .replace('<flag>', flag)
                        .replace('<user>', user.tag))
                    .setColor('Random');
                
                interaction.reply({embeds: [embed]});
                break;
        }
        
    }
}