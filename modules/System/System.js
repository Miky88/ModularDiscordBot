const Module = require("@core/Module.js");
const Discord = require('discord.js');
const fs = require('fs');
const ModulePriorities = require("@core/ModulePriorities.js");

module.exports = class System extends Module {
    constructor(client) {
        super(client, {
            name: "System",
            info: "Loads the system commands",
            enabled: true,
            events: ["clientReady", "interactionCreate"],
            priority: ModulePriorities.HIGHEST
        })
    }

    /**
     * @param {import('../../index.js')} client 
     */
    async clientReady(client) {
        let serverIds = this.client.config.get('systemServer');

        if (!serverIds) {
            this.logger.error(`System servers not found in config.yml!`);
            return;
        }

        for (const serverId of serverIds) {
            try {
                let systemGuild = await this.client.guilds.fetch(serverId);

                if (!systemGuild) {
                    this.logger.error(`System server not found: ${serverId}. Set it on config.yml!`);
                }

                await systemGuild.commands.set(this.systemCommands.map(c => c.toJson()));
            } catch (error) {
                this.logger.error(`Failed to fetch server ${serverId}: ${error}`);
            }
        }

        this.commands = this.systemCommands;

        // If the bot got rebooted with reboot command, this will edit the message once ready
        try {
            const { id, channel } = require("./../reboot.json");
            let c = client.channels.cache.get(channel);
            await c.messages.fetch();
            let m = c.messages.cache.get(id);
            await m.edit(":white_check_mark: Rebooted. It took " + ((Date.now() - m.createdTimestamp) / 1000).toFixed(1) + "ms");
            fs.unlink("./reboot.json", () => { });
        } catch (e) {
            // pass
        }
    }

    /**
     * @param {import('../../index.js')} client
     * @param {Discord.Interaction} interaction
     */
    async interactionCreate(client, interaction) {
        if (!interaction.isAutocomplete()) return;
        const command = this.systemCommands.get(interaction.commandName);
        if (!command) return;

        if (interaction.commandName == "modman") {
            let modules = [...this.client.moduleManager.modules.keys()].filter(m => m != this.options.name);
            let options = modules.map(m => ({ name: m, value: m }));
            return interaction.respond(options);
        }
    }

    // Override
    async loadCommands() {
        this.systemCommands = new Discord.Collection();
        const commands = fs.existsSync(`@modules/${this.options.name}/commands`) ? fs.readdirSync(`@modules/${this.options.name}/commands`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('./InteractionCommand')}
                 */
                const command = require(`@modules/${this.options.name}/commands/${file}`);
                delete require.cache[require.resolve(`../../modules/${this.options.name}/commands/${file}`)];
                const _command = new command(this.client, this);

                this.systemCommands.set(file.split(".")[0], _command);
                this.logger.verbose(`Loaded system command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load system command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        });
    }
}
