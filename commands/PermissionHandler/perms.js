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
  aliases: ['restart'], // Array of aliases
  cooldown: 0, // Command cooldown
};
