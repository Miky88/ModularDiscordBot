let { EmbedBuilder, ApplicationCommandOptionType, escapeMarkdown } = require('discord.js')
const Command = require('../../modules/Command')

module.exports = class PermsCommand extends Command {
    constructor() {
        super({
            name: 'perms',
            description: 'Shows yours or another user\'s permission level',
            minLevel: -1,
            options: [
                {
                    name: "user",
                    description: "User to get powerlevel from",
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        })
    }

    async run(client, interaction, args) {
        const { user } = args;

        const data = await client.database.forceUser(user.id)
        if (!data) return interaction.reply(`${yellowtick} There's no user in database matching your query`)
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return

        let level = client.config.powerlevels.find(pl => pl.level == data.powerlevel) || client.config.powerlevels.find(pl => pl.level == 0)
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Powerlevel`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`**${level.icon} ${level.level} - ${level.name}**\n${level.description}`)
            .setColor("Random")
        if (data.blacklistReason && data.powerlevel < 0)
            embed.addField('Blacklist reason', `\`\`\`${escapeMarkdown(data.blacklistReason)}\`\`\``)

        interaction.reply({ embeds: [embed] })
    }
}