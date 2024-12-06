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
    }

    /**
     * 
     * @param {import('../..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        let flag = interaction.options.getString('flag');
        let user = interaction.options.getUser('user');
        let flags;
        let flags;
        switch (interaction.options.getSubcommand()) {
            case "list":
                try{
                    flags = client.database.getFlags(args.user);
                } catch(e){
                    return interaction.reply(this.module.config.get("flags.list.none").replace('<user>', user.tag));
                }
                if(flags.length > 0){
                    return interaction.reply(`${this.module.config.get("flags.list.title").replace('<user>', user.tag)} \n>>> ${flags.map(fl => "- " + this.module.config.get("flags.list.flags." + fl)).join("\n")}`);
                } else {
                    return interaction.reply(this.module.config.get("flags.list.none")
                    return interaction.reply(this.module.config.get("flags.list.none")
                        .replace('<user>', user.tag)
                    );
                }
            case "add":
                try{
                    flags = client.database.getFlags(args.user);
                } catch(e){
                    client.database.addUser(args.user);
                    flags = client.database.getFlags(args.user);
                }
                if(flags.includes(flag)){
                    const alreadyHasFlag = this.module.config.get("flags.errors.alreadyHasFlag");
                    interaction.reply(alreadyHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, true)

                const flagadded = this.module.config.get("flags.add")
                const flagadded = this.module.config.get("flags.add")
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagadded);

                break;
            
            case "remove":
                try{
                    flags = client.database.getFlags(args.user);
                } catch(e){
                    return interaction.reply(this.module.config.get("flags.errors.notHasFlag").replace('<user>', user.tag));
                }
                if(!(flags.includes(flag))){
                    const notHasFlag = this.module.config.get("flags.errors.notHasFlag");
                    const notHasFlag = this.module.config.get("flags.errors.notHasFlag");
                    interaction.reply(notHasFlag);
                    return;
                }
                client.database.setFlag(args.user, flag, false);

                const flagremoved = this.module.config.get("flags.remove")
                const flagremoved = this.module.config.get("flags.remove")
                    .replace('<flag>', flag)
                    .replace('<user>', user.tag);
                
                interaction.reply(flagremoved);
                break;
        }
        
    }
}