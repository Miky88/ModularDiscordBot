const { yellowTick } = require('../../modules/Emojis')
let { MessageEmbed, Util } = require('discord.js')

exports.run = async (client, message, args) => {
    let [_user, ..._level] = args;
    if(!_user || !_level) return message.channel.send(`${yellowTick} You need to type a valid user and a powerlevel in order to set an user's powerlevel.`)
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
    
    let newlevel = client.config.powerlevels.find(pl => pl.level == _level[0]) || client.config.powerlevels.find(pl => pl.name.toLowerCase() == _level.join(' ').toLowerCase())
    if(!newlevel) return message.channel.send(`${yellowTick} You entered an invalid powerlevel. Here's a list of available powerlevels:\n>>> ${client.config.powerlevels.map(pl => `\`${pl.level}\` - \`${pl.name}\``).join("\n")}`)

    data.powerlevel = newlevel.level
    client.database.updateUser(data)

    const embed = new MessageEmbed()
        .setTitle(`${user.tag}'s new Powerlevel`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`**${newlevel.icon} ${newlevel.level} - ${newlevel.name}**\n${newlevel.description}`)
        .setColor("RANDOM")

    message.channel.send(embed)
}

exports.help = {
    name: ':magic_wand:setlevel',
    info: 'Sets an user\'s permission level',
    usage: '<user> <level>',
}

exports.config = {
    aliases: [], // Array of aliases
    cooldown: 0, // Command cooldown
    minLevel: 9, // Minimum level require to execute the command
    reqPerms: [], // Array of required user permissions to perform the command
    botPerms: [] // Array of required bot permissions to perform the command
};