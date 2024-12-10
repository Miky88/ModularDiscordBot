let { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js')
const Command = require('../../structures/Command.js');

module.exports = class PermsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'perms',
            description: 'Shows yours or another user\'s flags',
            minLevel: -1,
            options: [
                {
                    name: "user",
                    description: "User to get flags from",
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        })
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        let user = interaction.options.getUser("user");
        if (!user) user = interaction.user;

        const data = await client.database.forceUser(user.id)
        if (!data) return await interaction.reply(`${yellowtick} There's no user in database matching your query`)
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return;

        const flags = await client.database.getFlags(user.id);

        const embed = new EmbedBuilder()
            .setTitle(`${user.discriminator ? user.tag : user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields([
                {
                    name: "Flags",
                    value: flags.length ? flags.map(fl => `- ${client.moduleManager.modules.get("System").config.get("flags.list.flags." + fl)}`).join("\n") : "This user has no flags"
                },
            ])
            // .setDescription(`todo`)
            .setColor("Random")

        await interaction.reply({ embeds: [embed] });
    }
}
