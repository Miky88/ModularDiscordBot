exports.run = async (client, message, args) => {

  if(!args || args.size < 1) return message.channel.send(`:warning: Please specify a command name`)
  const commandName = args[0]

  try {
    delete require.cache[require.resolve(`./${commandName}.js`)]
    const props = require(`./${commandName}.js`)

    client.commands.set(commandName, props)

    message.channel.send(`:white_check_mark: Command \`${commandName}\` has been reloaded`)
  } catch (error) {
    message.channel.send(`:x: An error occured while reloading the command:
        \`\`\`${error.name}: ${error.message}\`\`\``)
  }

}

exports.help = {
  name: ':arrows_counterclockwise:reload',
  info: 'Reloads a command',
  usage: '<command>',
}

exports.config = {
  aliases: [], // Array of aliases
  cooldown: 3, // Command cooldown
};
