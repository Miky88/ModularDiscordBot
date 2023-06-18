let { EmbedBuilder, ApplicationCommandOptionType, escapeMarkdown } = require('discord.js')
const Command = require('../../modules/Command')

module.exports = class PermsCommand extends Command {
    constructor() {
        super({
            name: 'perms',
            description: 'Shows yours or another user\'s permission levels',
            minLevel: -1,
            options: [
                {
                    name: "user",
                    description: "User to get levels from",
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

        let level = client.config.powerlevels.find(pl => pl.level == data.powerlevel) || client.config.powerlevels.find(pl => pl.level == 0);
        let guildlevel = client.config.guildlevels.find(gl => gl.level == data.guildlevel) || client.config.guildlevels.find(gl => gl.level == 0);
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields([
                {
                    name: "Powerlevel",
                    value: `**${level.icon} ${level.level} - ${level.name}**\n${level.description}`
                },
                {
                    name: "Guildlevel",
                    value: `**${guildlevel.icon} ${guildlevel.level} - ${guildlevel.name}**\n${guildlevel.description}`
                }
            ])
            .setDescription(`**${level.icon} ${level.level} - ${level.name}**\n${level.description}`)
            .setColor("Random")
        if (data.blacklistReason && data.powerlevel < 0)
            embed.addField('Blacklist reason', `\`\`\`${escapeMarkdown(data.blacklistReason)}\`\`\``)
        else if (data.guildBlacklistReason && data.guildlevel < 0)
            embed.addField('Guild Blacklist reason', `\`\`\`${escapeMarkdown(data.guildBlacklistReason)}\`\`\``)

        interaction.reply({ embeds: [embed] })
    }
}