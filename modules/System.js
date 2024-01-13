const Module = require("../structures/Module.js");
const Discord = require('discord.js');
const fs = require('fs');

module.exports = class System extends Module {
    constructor(client) {
        super(client, {
            info: "Loads the system utility commands",
            enabled: true,
            event: ["ready"]
        })
    }

    async ready(client) {
        let serverId = this.client.config.get('systemServer');
        if(!serverId) {
            this.logger.error(`System server not set in config.yml!`);
            return;
        }
        
        let systemGuild = await this.client.guilds.fetch(serverId);
        if (!systemGuild) {
            this.logger.error(`System server not found. Set it in config.yml!`);
            return;
        }

        systemGuild.commands.set(this.systemCommands.map(c => c.toJson()))
        
        this.commands = this.systemCommands;
    }


    // Override
    async loadCommands() {
        this.systemCommands = new Discord.Collection();
        const commands = fs.existsSync(`./modules/${this.options.name}`) ? fs.readdirSync(`./modules/${this.options.name}`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('./InteractionCommand')}
                 */
                const command = new (require(`../modules/${this.options.name}/${file}`));
                delete require.cache[require.resolve(`../modules/${this.options.name}/${file}`)];

                this.systemCommands.set(file.split(".")[0], command);
                this.logger.verbose(`Loaded system command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load system command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        });
    }
}