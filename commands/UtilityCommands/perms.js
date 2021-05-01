const { yellowTick } = require('../../modules/Emojis')
let { MessageEmbed, Util } = require('discord.js')

exports.run = async (client, message, args) => {
  let user;
  try {
    user = await client.users.fetch((args[0] || message.author.id).replace(/\D/gmi, ''))
  } catch (e) {
    if (e.httpStatus == 404)
      return message.channel.send(`${yellowTick} There's no user matching your query`)
    else
      return message.channel.send(`${yellowTick} Something went wrong while fetching the user from the Discord API`)
  }

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

  message.channel.send(embed)
}

exports.help = {
  name: ':man_astronaut:perms',
  info: 'Shows yours or another user\'s permission level',
  usage: '[user]',
}

exports.config = {
  aliases: [], // Array of aliases
  cooldown: 0, // Command cooldown
  minLevel: '-1', // Minimum level require to execute the command
  reqPerms: [], // Array of required user permissions to perform the command
  botPerms: [] // Array of required bot permissions to perform the command
};