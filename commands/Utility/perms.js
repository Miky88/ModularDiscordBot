let { EmbedBuilder, Util } = require('discord.js')
const Command = require('../../modules/Command')

module.exports = class PermsCommand extends Command {
    constructor() {
        super({
            name: ':man_astronaut:perms',
            description: 'Shows yours or another user\'s permission level',
            minLevel: -1,
            options: [
                {
                    name: "user",
                    description: "User to get powerlevel from",
                    type: "USER",
                    required: false
                }
            ]
        })
    }

    async run(client, message, args) {
        const { user } = args;

        const data = await client.database.forceUser(user.id)
        if (!data) return message.channel.send(`${yellowtick} There's no user in database matching your query`)
        if (message.author.data.powerlevel < 0 && data.user.id !== message.author.id) return

        let level = client.config.powerlevels.find(pl => pl.level == data.powerlevel) || client.config.powerlevels.find(pl => pl.level == 0)
        const embed = new EmbedBuilder()
            .setTitle(`${user.tag}'s Powerlevel`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`**${level.icon} ${level.level} - ${level.name}**\n${level.description}`)
            .setColor("RANDOM")
        if (data.blacklistReason && data.powerlevel < 0)
            embed.addField('Blacklist reason', `\`\`\`${Util.escapeMarkdown(data.blacklistReason)}\`\`\``)

        message.channel.send({ embeds: [embed] })
    }
}