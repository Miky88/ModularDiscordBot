const { yellowtick, redtick } = require('../includes/emotes')
let util = require('discord.js').Util
let {MessageEmbed} = require('discord.js')
exports.run = async (client, message, args) => {
  const user = client.database.fetchUser((args[0] || message.author.id).replace(/\D/gmi, ''))

  if (!data) return message.channel.send(`${yellowtick} There's no user in database matching your query`)
  if (message.author.data.powerlevel < 0 && data.user.id !== message.author.id) return

  const embed = new MessageEmbed()
    .setTitle(`${data.user.tag}'s Powerlevel`)
    .setThumbnail(data.user.displayAvatarURL())
    .addField('Power level', client.pl.getLevelTag(data.powerlevel))
  if (data.blacklistReason && data.powerlevel < 0)
    embed.addField('Blacklist reason', `\`\`\`${util.escapeMarkdown(data.blacklistReason)}\`\`\``)

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