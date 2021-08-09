// Imports
require('dotenv').config();

const { Client, Collection, Intents, TextChannel } = require('discord.js');
require('./modules/Functions.js');
const { PluginManager } = require('./modules/PluginManager.js');
const Database = require('./modules/Database.js');

// Discord
class BotClient extends Client {
    constructor(options) {
        super (options);

        this.config = require('./config.js');
        this.commands = new Collection();
        this.slashCommands = new Collection();
        this.PluginManager = new PluginManager(this);
        this.PluginManager.init();

        this.database = new Database(this);
    }

    logError(...data) {
        console.error(...data);
        /** @type {TextChannel} */
        const channel = this.channels.resolve(this.config.debug);
        channel.send(":no_entry: " + require("util").format(...data)).catch(() => null);
    }

    logDebug(...data) {
        /** @type {TextChannel} */
        const channel = this.channels.resolve(this.config.debug);
        channel.send(":information_source: " + require("util").format(...data)).catch(() => null);
    }
};

const client = new BotClient({ intents: Object.values(Intents.FLAGS).reduce((a, b) => a | b), partials: ['REACTION', 'MESSAGE'] });

client.login(client.config.token);

module.exports = BotClient;