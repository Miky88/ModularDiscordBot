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
        this.settings = {
            list: {
                title: "🚩 <user>'s flags:",
                flags: {
                    OWNER: "**Bot Owner**: This user is a developer of this bot",
                    STAFF: "**Bot Staff**: This user has staff priviliges on this bot",
                    PREMIUM: "**Premium**: This user supported the development of this bot",
                    BLACKLISTED: "**Blacklisted**: This user is blacklisted from this bot",
                },
                none: "🚩 <user> has no flags"
            },
            add: "✅ Flag `<flag>` has been assigned to <user>",
            remove:"✅ Flag `<flag>` has been removed to <user>",
            errors: {
                alreadyHasFlag: "⚠️ Flag already assigned",
                notHasFlag: "⚠️ Nothing to remove"
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
        let user = interaction.options.getUser('user');
        switch (interaction.options.getSubcommand()) {
            case "list":
                if(flags.length > 0){
                    return interaction.reply(`${this.settings.list.title.replace('<user>', user.tag)} \n>>> ${flags.map(fl => "- " + this.settings.list.flags[fl]).join("\n")}`);
                } else {
                    return interaction.reply(this.settings.list.none
                        .replace('<user>', user.tag)
                    );
                }
                
                let message = "";
                message += this.settings.list.title
                    .replace('<user>', user.tag);
                message += flagStrings;

                interaction.reply(message);
                break;
            
            case "add":
                if(flags.includes(flag)){
                    const alreadyHasFlag = this.settings.errors.alreadyHasFlag;
                    interaction.reply(alreadyHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, true)

                const flagadded = this.settings.add
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagadded);

                break;
            
            case "remove":
                if(!(flags.includes(flag))){
                    const notHasFlag = this.settings.errors.notHasFlag;
                    interaction.reply(notHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, false);

                const flagremoved = this.settings.remove
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagremoved);
                break;
        }
        
    }
}