exports.run = async (client, message, args) => {
  const msg = await message.channel.send(`Pong!`);
  msg.edit(`:ping_pong:Pong! Latency: \`${msg.createdTimestamp - message.createdTimestamp}ms\`. API Latency: \`${Math.round(client.ws.ping)}ms\``);
};

exports.help = {
  name: ":ping_pong:ping",
  info: "Check if the bot responds",
  usage: ""
};

exports.config = {
  aliases: ["pong"], // Array of aliases
  cooldown: 3, // Command cooldown
  minLevel: 0, // Minimum level require to execute the command
  reqPerms: [], // Array of required user permissions to perform the command
  botPerms: [] // Array of required bot permissions to perform the command
};