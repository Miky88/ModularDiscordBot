const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType, EmbedBuilder, userMention, User, UserContextMenuCommandInteraction } = require('discord.js');

module.exports = class FlagsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
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
        console.log(client)
    }

    /**
     * 
     * @param {import('../..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        console.log(this.module)
        let flag = interaction.options.getString('flag');
        let user = interaction.options.getUser('user');
        let flags = client.database.getFlags(args.user);
        switch (interaction.options.getSubcommand()) {
            case "list":
                if(flags.length > 0){
                    return interaction.reply(`${this.module.config.get("list.title").replace('<user>', user.tag)} \n>>> ${flags.map(fl => "- " + this.config.get("list.flags." + fl).join("\n"))}`);
                } else {
                    return interaction.reply(this.config.get("list.none")
                        .replace('<user>', user.tag)
                    );
                }
                
                let message = "";
                message += this.config.get("list.title")
                    .replace('<user>', user.tag);
                message += flagStrings;

                interaction.reply(message);
                break;
            
            case "add":
                if(flags.includes(flag)){
                    const alreadyHasFlag = this.config.get("errors.alreadyHasFlag");
                    interaction.reply(alreadyHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, true)

                const flagadded = this.config.get("add")
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagadded);

                break;
            
            case "remove":
                if(!(flags.includes(flag))){
                    const notHasFlag = this.config.get("errors.notHasFlag");
                    interaction.reply(notHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, false);

                const flagremoved = this.config.get("remove")
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagremoved);
                break;
        }
        
    }
}