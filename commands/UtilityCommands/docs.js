const request = require("superagent")
exports.run = async (client, message, args) => {
  if(!args[0]) return message.reply("No query specified.")
  let queryString = args.join(" ")
  let project = "stable"
  let res = await request.get(`https://djsdocs.sorta.moe/v2/embed?src=${project}&q=${queryString}`)
  if(!res.body || res.body == null) return message.reply("No match")
  message.channel.send({embed: res.body})
};

exports.help = {
  name: ":notebook_with_decorative_cover:docs",
  info: "Search on Discord.js Docs",
  usage: "[code]",
};

exports.config = {
  aliases: [], // Array of aliases
  cooldown: 3, // Command cooldown
  minLevel: 0, // Minimum level require to execute the command
  reqPerms: [], // Array of required user permissions to perform the command
  botPerms: [] // Array of required bot permissions to perform the command
};