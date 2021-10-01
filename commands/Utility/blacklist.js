let { MessageEmbed, Util } = require('discord.js')
const BaseCommand = require('../../modules/BaseCommand')

module.exports = class BlacklistCommand extends BaseCommand {
    constructor() {
        super({
            name: ':notebook:blacklist',
            info: 'Blacklists an user from the bot',
            usage: '<user> <reason>',
            minLevel: 6,
            args: [
                {
                    name: "user",
                    type: "member",
                },
                {
                    name: "reason",
                    type: "string",
                    default: "Nessuna motivazione fornita."
                }
            ]
        })
    }

    async run(client, message, args) {
        const { user, reason } = args;

        const data = await client.database.forceUser(user.id)
        if (!data) return message.channel.send(`${yellowtick} There's no user in database matching your query`)

        if (message.author.data.powerlevel <= data.powerlevel)
            return message.channel.send(`${redTick} You can't blacklist this user.`)

        let blacklistLevel = client.config.powerlevels.find(pl => pl.level == -1)
        data.powerlevel = blacklistLevel.level
        data.blacklistReason = reason
        client.database.updateUser(data)

        const embed = new MessageEmbed()
            .setTitle(`${user.tag}'s new Powerlevel`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`**${blacklistLevel.icon} ${blacklistLevel.level} - ${blacklistLevel.name}**\n${blacklistLevel.description}`)
            .addField('Blacklist reason', `\`\`\`${Util.escapeMarkdown(data.blacklistReason)}\`\`\``)
            .setColor("RANDOM")

        message.channel.send({ embeds: [embed] })
    }
}