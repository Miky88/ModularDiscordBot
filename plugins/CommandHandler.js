const BasePlugin = require("../base/BasePlugin.js");
let cooldownCache = new Set()

class CommandHandler extends BasePlugin {
  constructor() {
    super({
      name: "CommandHandler",
      info: "Manages bot commands",
      enabled: true,
      event: "message"
    })
  }

  async run(client, message) {
    message.mods = {}
    // Ignore bots and non-commands
    if (message.author.bot) return;
    if (!message.content.startsWith(client.config.prefix)) return;

    // Define command arguments
    const args = message.content.slice(client.config.prefix.length).trim().split(/ +/g);

    // Define flags
    let flags = args.filter(e => e.startsWith("--"))
    flags.forEach(x => args.remove(x))
    message.mods.flags = flags

    //Define command
    const command = args.shift().toLowerCase();

    // Command check
    const cmd = client.commands.get(command) || client.commands.find(c => c.config.aliases.includes(command));
    if (!cmd) return;
    if(cmd.config.ownerOnly && message.author.id !== client.config.owner) return 
    // Cooldown check
    const limitFlag = `${message.author.id}-${cmd.help.name}`;
    if (cooldownCache.has(limitFlag)) return message.channel.send(":timer: You are on cooldown. Please try again later");

    //Run command
    try {
        cooldownCache.add(limitFlag);
        setTimeout(() => {
            cooldownCache.delete(limitFlag);
        }, cmd.config.cooldown * 1000);

        await cmd.run(client, message, args);
    } catch (e) {
        console.error(e)
    }
  }
}

module.exports = CommandHandler;