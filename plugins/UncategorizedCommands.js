const BasePlugin = require("../modules/BasePlugin.js");

class UtilityCommands extends BasePlugin {
    constructor() {
        super({
            name: "UtilityCommands",
            info: "Manages the Utility commands",
            enabled: true,
            event: "ready"
        })
    }

    async run(_client, ..._args) { // enhance™ the user experience™
        const commands = fs.readdirSync(`./commands`).filter(file => file.endsWith(".js")) || [];
        commands.forEach(file => {
            this.commands.set(file.split(".")[0], require(`../commands/${file}`))
            console.log(`[Plugin Manager] Loaded command ${file} from ${this.about.name}`)
        });
    }
}

module.exports = UtilityCommands;