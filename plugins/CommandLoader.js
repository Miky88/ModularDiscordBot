const BasePlugin = require("../modules/BasePlugin.js");
const fs = require("fs");
module.exports = class CommandLoader extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "CommandLoader",
            info: "Loads commands that don't have a parent plugin",
            enabled: true
        });
    }

    async loadCommands() {
        const commands = fs.readdirSync(`./commands`).filter(file => file.endsWith(".js")) || [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('../modules/BaseCommand')}
                 */
                const command = new (require(`../commands/${file}`));
                delete require.cache[require.resolve(`../commands/${file}`)];
                if(command.interaction) {
                    this.interactionCommands.set(file.split(".")[0], command);
                    this.log(`Loaded interaction command ${file}`);
                } else {
                    this.commands.set(file.split(".")[0], command);
                    this.log(`Loaded command ${file}`);
                }
            } catch (e) {
                this.log(`Failed to load command ${file}:\n${e}`);
            }
        });
    }

    async run(_client, ..._args) {
        // pass
    }
}