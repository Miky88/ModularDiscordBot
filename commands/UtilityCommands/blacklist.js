const { yellowTick } = require('../../modules/Emojis')
let { MessageEmbed, Util } = require('discord.js')

exports.run = async (client, message, args) => {
    let [_user, ..._reason] = args;
    if(!_user || !_reason) return message.channel.send(`${yellowTick} You need to type a valid user and reason in order to blacklist an user.`)
    let user;
    try {
        user = await client.users.fetch((_user || message.author.id).replace(/\D/gmi, ''))
    } catch (e) {
        if (e.httpStatus == 404)
            return message.channel.send(`${yellowTick} There's no user matching your query`)
        else
            return message.channel.send(`${yellowTick} Something went wrong while fetching the user from the Discord API`)
    }

    const data = await client.database.forceUser(user.id)
    if (!data) return message.channel.send(`${yellowtick} There's no user in database matching your query`)
    
    let blacklistLevel = client.config.powerlevels.find(pl => pl.level == -1)
    data.powerlevel = blacklistLevel.level
    data.blacklistReason = _reason.join(" ")
    client.database.updateUser(data)

    const embed = new MessageEmbed()
        .setTitle(`${user.tag}'s new Powerlevel`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`**${blacklistLevel.icon} ${blacklistLevel.level} - ${blacklistLevel.name}**\n${blacklistLevel.description}`)
        .addField('Blacklist reason', `\`\`\`${Util.escapeMarkdown(data.blacklistReason)}\`\`\``)
        .setColor("RANDOM")

    message.channel.send(embed)
}
exports.help = {
    name: ':notebook:blacklist',
    info: 'Blacklists an user from the bot',
    usage: '<user> <reason>',
}

exports.config = {
    aliases: [], // Array of aliases
    cooldown: 0, // Command cooldown
    minLevel: 6, // Minimum level require to execute the command
    reqPerms: [], // Array of required user permissions to perform the command
    botPerms: [] // Array of required bot permissions to perform the command
};