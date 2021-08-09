const BasePlugin = require("../modules/BasePlugin.js");
const fs = require("fs");

class UncategorizedCommands extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "UncategorizedCommands",
            info: "Loads commands that don't have a parent category",
            enabled: true
        });
    }

    async loadCommands() {
        const commands = fs.readdirSync(`./commands`).filter(file => file.endsWith(".js")) || [];

        commands.forEach(file => {
            try {
                const command = new (require(`../commands/${file}`));
                delete require.cache[require.resolve(`../commands/${file}`)];
            
                this.commands.set(file.split(".")[0], command);
                console.log(`[Plugin Manager] Loaded command ${file} from ${this.about.name}`);
            } catch (e) {
                console.error(`[Plugin Manager] Failed to load command ${file} from ${this.about.name}: ${e}`);
            }
        });
    }

    async run(_client, ..._args) {
        // pass
    }
}

module.exports = UncategorizedCommands;