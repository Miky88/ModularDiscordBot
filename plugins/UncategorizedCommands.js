const BasePlugin = require("../modules/BasePlugin.js");
const fs = require("fs");

class UncategorizedCommands extends BasePlugin {
    constructor() {
        super({
            name: "UncategorizedCommands",
            info: "Loads commands that don't have a parent category",
            enabled: true
        })
        this.loadCommands = async () => {
            const commands = fs.readdirSync(`./commands`).filter(file => file.endsWith(".js")) || [];
            commands.forEach(file => {
                this.commands.set(file.split(".")[0], require(`../commands/${file}`))
                console.log(`[Plugin Manager] Loaded command ${file} from ${this.about.name}`)
            });    
        }
    }


    async run(_client, ..._args) {
        // pass
    }
}

module.exports = UncategorizedCommands;