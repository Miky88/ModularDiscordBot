const Module = require("@structures/Module.js");
const Discord = require('discord.js');
const fs = require('fs');
const ModmanUI = require('./lib/ModmanUI.js');
const EvalUI = require('./lib/EvalUI.js');

module.exports = class System extends Module {
    constructor(client) {
        super(client, {
            name: "System",
            info: "Loads the system commands",
            events: ["clientReady", "interactionCreate"]
        });

        this.modmanUI = new ModmanUI(this);
        this.evalUI = new EvalUI(this);
    }

    /**
     * Override base `start()` so System keeps its custom dual-collection
     * pattern: system commands live in `this.systemCommands` (registered only
     * in the system-server guilds) AND are mirrored to `this.commands` so the
     * regular getCommand() resolver can find them.
     */
    async start(client) {
        await this.loadCommands();           // populates this.systemCommands
        this.commands = this.systemCommands; // mirror so the manager sees them
    }

    async stop(client) {
        if (this.systemCommands) this.systemCommands.clear();
        this.commands = new Discord.Collection();
    }

    /**
     * @param {import('../../index.js')} client
     */
    async clientReady(client) {
        const serverIds = this.client.config.get('systemServer');
        if (!serverIds) {
            this.logger.error(`System servers not found in config.yml!`);
            return;
        }

        for (const serverId of serverIds) {
            try {
                const systemGuild = await this.client.guilds.fetch(serverId);
                if (!systemGuild) {
                    this.logger.error(`System server not found: ${serverId}. Set it on config.yml!`);
                    continue;
                }
                await systemGuild.commands.set(this.systemCommands.map(c => c.toJson()));
            } catch (error) {
                this.logger.error(`Failed to fetch server ${serverId}: ${error}`);
            }
        }

        // If the bot got rebooted with reboot command, this will edit the message once ready
        try {
            const { id, channel } = require("../../reboot.json");
            const c = client.channels.cache.get(channel);
            await c.messages.fetch();
            const m = c.messages.cache.get(id);
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
        // GUI component / modal interactions belonging to the System module.
        if (interaction.isMessageComponent?.() || interaction.isModalSubmit?.()) {
            const id = interaction.customId || '';
            if (id.startsWith('modman:')) return this.modmanUI.handle(interaction);
            if (id.startsWith('eval:'))   return this.evalUI.handle(interaction);
        }
    }

    // Override loadCommands: System keeps its commands in `this.systemCommands`
    // because they're registered to system-server guilds only, separate from the
    // global slash command set ICH publishes.
    async loadCommands() {
        this.systemCommands = new Discord.Collection();
        const dir = `./modules/${this.options.name}/commands`;
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(file => file.endsWith(".js")) : [];

        for (const file of files) {
            try {
                const commandPath = require.resolve(`@modules/${this.options.name}/commands/${file}`);
                delete require.cache[commandPath];
                const CommandClass = require(commandPath);
                const command = new CommandClass(this.client, this);
                this.systemCommands.set(file.split(".")[0], command);
                this.logger.verbose(`Loaded system command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load system command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        }
    }
};
