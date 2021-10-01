const { Interaction } = require("discord.js");
const BotClient = require("..");
const BasePlugin = require("./BasePlugin");
const Command = require("./Command");

module.exports = class InteractionCommand extends Command {
    /**
     * @param {object} options 
     * @param {import("discord-api-types").APIApplicationCommand["name"]} options.name
     * @param {import("discord-api-types").APIApplicationCommand["description"]} options.description
     * @param {import("discord-api-types").APIApplicationCommand["options"]} options.options
     */
    constructor({
        name = 'Unspecified',
        description = 'Unspecified.',
        options = [],
        type = 'CHAT_INPUT',
        cooldown = 0,
        minLevel = 0,
        reqPerms = [],
        botPerms = [],
    }) {
        super(true);

        this.data = {
            name,
            description,
            options,
            type
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

    toJson() {
        if (!this.interaction)
            return null;

        return (!this.data.type || this.data.type == "CHAT_INPUT") ? {
            name: this.data.name,
            description: this.data.description,
            options: this.data.options,
            type: this.data.type
        } : {
            name: this.data.name,
            type: this.data.type
        }
    }
}