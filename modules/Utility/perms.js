let { EmbedBuilder, ApplicationCommandOptionType, escapeMarkdown } = require('discord.js')
const Command = require('../../structures/Command.js')

module.exports = class PermsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
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
        let { user } = args;
        if (!user) user = interaction.user

        const data = await client.database.forceUser(user.id)
        if (!data) return interaction.reply(`${yellowtick} There's no user in database matching your query`)
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return

        const embed = new EmbedBuilder()
            .setTitle(`${user.discriminator ? user.tag : user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields([
                {
                    name: "Flags",
                    value: `todo`
                },
                {
                    name: "Guildlevel",
                    value: `todo`
                }
            ])
            .setDescription(`todo`)
            .setColor("Random")
        if (data.blacklistReason && data.powerlevel < 0)
            embed.addField('Blacklist reason', `\`\`\`${escapeMarkdown(data.blacklistReason)}\`\`\``)
        else if (data.guildBlacklistReason && data.guildlevel < 0)
            embed.addField('Guild Blacklist reason', `\`\`\`${escapeMarkdown(data.guildBlacklistReason)}\`\`\``)

        interaction.reply({ embeds: [embed] })
    }
}