exports.run = async (client, message, args) => {
  let perm = message.author.data.powerlevel
  // TODO: .
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