let { MessageEmbed, Util } = require('discord.js')
const BaseCommand = require('../../modules/BaseCommand')

module.exports = class PermsCommand extends BaseCommand {
    constructor() {
        super({
            name: ':man_astronaut:perms',
            info: 'Shows yours or another user\'s permission level',
            usage: '[user]',
            minLevel: '-1',
            args: [
                {
                    name: "user",
                    type: "user",
                    default: msg => msg.author
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
        const embed = new MessageEmbed()
            .setTitle(`${user.tag}'s Powerlevel`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`**${level.icon} ${level.level} - ${level.name}**\n${level.description}`)
            .setColor("RANDOM")
        if (data.blacklistReason && data.powerlevel < 0)
            embed.addField('Blacklist reason', `\`\`\`${Util.escapeMarkdown(data.blacklistReason)}\`\`\``)

        message.channel.send({ embeds: [embed] })
    }
}