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
                title: "🚩 <user>'s flags:\n\n",
                flags: {
                    owner: "> - **Bot Owner**: This user is a owner of this bot.\n",
                    staff: "> - **Bot Staffer**: This user is a staffer of this bot. You can talk to him for support.\n",
                    premium: "> - **Premium**: This user is premium on this bot and supported the development.\n",
                    blacklisted: "> - **Blacklisted**: This user is blacklisted from this bot. You shouldn't talk to him.\n",
                    user: "> - **User**: A normal user of this bot.\n",
                    none: "🚩 <user> has no flags"
                }
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
        let user = interaction.user;
        switch (interaction.options.getSubcommand()) {
            case "list":
                let flagStrings = "";
                if (flags.includes("OWNER")) {
                    flagStrings += this.settings.list.flags.owner;
                }
                if (flags.includes("STAFF")) {
                    flagStrings += this.settings.list.flags.staff;
                }
                if (flags.includes("PREMIUM")) {
                    flagStrings += this.settings.list.flags;
                }
                if (flags.includes("BLACKLISTED")) {
                    flagStrings += this.settings.list.flags.blacklisted;
                }
                if (flags.includes("USER")) {
                    flagStrings += this.settings.list.flags.user;
                }
                if(flagStrings == ""){
                    flagStrings += this.settings.list.flags.none
                        .replace('<user>', user.tag);
                    interaction.reply(flagStrings);
                    return;
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