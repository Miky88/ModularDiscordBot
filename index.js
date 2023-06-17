// Imports
require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
require('./modules/Functions.js');
const { PluginManager } = require('./modules/PluginManager.js');
const Database = require('./modules/Database.js');

// Discord
class BotClient extends Client {
    constructor(options) {
        super (options);

        this.config = require('./config.js');
        this.commands = new Collection();
        this.pluginManager = new PluginManager(this);
        this.pluginManager.init();

        this.database = new Database(this);
    }
};

const client = new BotClient({ intents: Object.values(GatewayIntentBits).reduce((a, b) => a | b), partials: [Partials.Reaction, Partials.Message] });

client.login(client.config.token);

module.exports = BotClient;