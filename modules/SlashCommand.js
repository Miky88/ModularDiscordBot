const { Interaction } = require("discord.js");
const BotClient = require("..");
const BasePlugin = require("./BasePlugin");
const Command = require("./Command");

class SlashCommand extends Command {
    /**
     * @param {object} options 
     * @param {import("discord-api-types").APIApplicationCommand["name"]} options.name
     * @param {import("discord-api-types").APIApplicationCommand["description"]} options.description
     * @param {import("discord-api-types").APIApplicationCommand["options"]} options.options
     */
    constructor({
        name = 'Non specificato',
        description = 'Non specificato',
        options = [],
        cooldown = 0,
        minLevel = 0,
        reqPerms = [],
        botPerms = [],
    }) {
        super(true);

        this.data = {
            name,
            description,
            options
        };

        this.help = { name, description };
        this.config = { cooldown, minLevel, reqPerms, botPerms };
    }

    /**
     * @param {BotClient} client 
     * @param {Interaction} interaction 
     * @param {object} args
     * @param {BasePlugin} plugin
     * @returns {Promise<any>}
     */
    run(client, interaction, args, plugin) {}
}

module.exports = SlashCommand;