const BasePlugin = require("../modules/BasePlugin.js");

class CommandHandler extends BasePlugin {
  constructor() {
    super({
      name: "CommandHandler",
      info: "Loads commands into the bot.",
      enabled: true,
      event: "message"
    })
    /** @type {Map<string, number>} */
    this.cooldownCache = new Map();
  }

  /**
   * @param {import("discord.js").Client & { commands: Map, PluginManager: import("../modules/PluginManager") }} client
   */
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
    const cmd = client.PluginManager.getCommand(command);
    if (!cmd) return;

    // Cooldown check
    const limitFlag = `${message.author.id}-${cmd.help.name}`;
    if (this.cooldownCache.has(limitFlag)) return message.channel.send(":timer: You are on cooldown. Please try again in " + ((this.cooldownCache.get(limitFlag) - Date.now()) / 1000).toFixed(1) + "s");

    //Run command
    try {
        this.cooldownCache.set(limitFlag, Date.now() + cmd.config.cooldown * 1000);
        setTimeout(() => {
            this.cooldownCache.delete(limitFlag);
        }, cmd.config.cooldown * 1000);
        await cmd.run(client, message, args);
    } catch (e) {
        message.channel.send()
        console.error(e)
    }
  }
}

module.exports = CommandHandler;