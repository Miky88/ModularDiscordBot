const BasePlugin = require("../modules/BasePlugin.js");

class CommandHandler extends BasePlugin {
  constructor() {
    super({
      name: "CommandHandler",
      info: "Loads commands into the bot.",
      enabled: true,
      event: "message",
      system: true
    })
    /** @type {Map<string, number>} */
    this.cooldownCache = new Map();
  }

  /**
   * @param {import("discord.js").Client & { commands: Map, PluginManager: import("../modules/PluginManager") }} client
   */
  async run(client, message) {

    // Initialize custom datas
    message.data = {}
    message.author.data = await client.database.forceUser(message.author.id)

    // Ignore bots and non-commands
    if (message.author.bot) return;
    if (!message.content.startsWith(client.config.prefix)) return;

    // Define command arguments
    const args = message.content.slice(client.config.prefix.length).trim().split(/ +/g);

    // Define flags
    let flags = args.filter(e => e.startsWith("--"))
    flags.forEach(x => args.remove(x))
    message.data.flags = flags

    //Define command
    const command = args.shift().toLowerCase();

    // Command check
    const cmd = client.PluginManager.getCommand(command);
    if (!cmd) return;

    // System Permission check
    if (message.author.data.powerlevel < cmd.config.minLevel)
      return message.channel.send(":no_entry: You don't have permission to perform this command. Minimum system permission required is " + cmd.config.minLevel + " and your system permission is " + message.author.data.powerlevel)
    // Server and Channel Permission check
    if(!message.channel.permissionsFor(message.author.id).has(cmd.config.reqPerms))
      return message.channel.send(":no_entry: You don't have the required permissions to perform this command: " + cmd.config.reqPerms.map(p => "`" + p.replace("_", " ").toProperCase() + "`").join(", "))
    // Bot Server and Channel Permission check
    if(!message.channel.permissionsFor(message.author.id).has(cmd.config.botPerms))
      return message.channel.send(":no_entry: The bot doesn't have the required permissions to perform this command: " + cmd.config.botPerms.map(p => "`" + p.replace("_", " ").toProperCase() + "`").join(", "))


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