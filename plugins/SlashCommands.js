const Discord = require('discord.js')
const BasePlugin = require("../modules/BasePlugin.js");
const fs = require('fs')

class SlashCommands extends BasePlugin {
  constructor() {
    super({
      name: "SlashCommands",
      info: "Adds slash commands support.",
      enabled: true,
      event: ["ready", "interaction"],
      system: true
    })
    this.slashCommands = new Discord.Collection();

    this.loadCommands = async () => {
      const commands = fs.existsSync(`./commands/${this.about.name}`) ? fs.readdirSync(`./commands/${this.about.name}`).filter(file => file.endsWith(".js")) : [];
      commands.forEach(file => {
        this.slashCommands.set(file.split(".")[0], require(`../commands/${this.about.name}/${file}`))
        console.log(`[Plugin Manager] Loaded slash command ${file} from ${this.about.name}`)
      });
    }
  }

  /**
   * @param {import("discord.js").Client & { commands: Map, PluginManager: import("../modules/PluginManager") }} client
   */
  async run(client, interaction) {
    if (!interaction) {
      // Fired on ready
      let currentCommands = await client.application.commands.fetch();
      this.slashCommands.forEach(command => {
        if(currentCommands.find(cmd => cmd.name == command.config.data.name)) return;
        
        client.application.commands.create(command.config.data);
      })
      currentCommands.forEach(cmd => {
        if(this.slashCommands.has(cmd.name)) return;

        client.application.commands.delete(cmd);
      })
      return;
    }
    if (!interaction.isCommand()) return;

    let cmd = this.slashCommands.get(interaction.commandName);
    let args = interaction.options.reduce((obj, option) => {
      obj[option.name] = option.value
      return obj
    }, {});

    await cmd.run(client, interaction, args);
  }
}

module.exports = SlashCommands;