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
  name: ":computer:docs",
  info: "Search on Discord.js Docs",
  usage: "[code]",
};

exports.config = {
  aliases: [], // Array of aliases
  cooldown: 3, // Command cooldown
};
