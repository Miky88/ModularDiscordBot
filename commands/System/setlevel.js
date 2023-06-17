const { emojis } = require('../../config.js')
let { EmbedBuilder } = require('discord.js')
const config = require('../../config')
const Command = require('../../modules/Command.js')

module.exports = class SetLevelCommand extends Command {
    constructor() {
        super({
            name: 'setlevel',
            info: 'Sets an user\'s permission level',
            usage: '<user> <level>',
            minLevel: 9,
            options: [
                {
                    name: "user",
                    description: "User to set powerlevel to",
                    type: "USER",
                    required: true
                },
                {
                    name: "level",
                    description: "Powerlevel to set",
                    type: "STRING",
                    required: true,
                    choices: config.powerlevels.map(c => ({ name: c.name, value: c.level }))
                }
            ]
        })
    }

    async run(client, message, args) {
        const { user, level } = args

        const data = await client.database.forceUser(user.id)
        if (!data) return message.channel.send(`${emojis.yellowTick} There's no user in database matching your query`)

        if (message.author.data.powerlevel <= data.powerlevel)
            return message.channel.send(`${emojis.redTick} You can't manage this user's powerlevel.`)

        let newlevel = client.config.powerlevels.find(pl => pl.level == level) || client.config.powerlevels.find(pl => pl.name.toLowerCase() == level.toLowerCase())
        if (!newlevel)
            return message.channel.send(`${emojis.yellowTick} You entered an invalid powerlevel. Here's a list of available powerlevels:\n>>> ${client.config.powerlevels.map(pl => `\`${pl.level}\` - \`${pl.name}\``).join("\n")}`)
        if (newlevel.level > 9)
            return message.channel.send(`${emojis.redTick} For security reasons Bot Owners can be empowered only from the configuration file.`)
        data.powerlevel = newlevel.level
        client.database.updateUser(data)

        const embed = new EmbedBuilder()
            .setTitle(`${user.tag}'s new Powerlevel`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`**${newlevel.icon} ${newlevel.level} - ${newlevel.name}**\n${newlevel.description}`)
            .setColor("RANDOM")

        message.channel.send({ embeds: [embed] })
    }
}