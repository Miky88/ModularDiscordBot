// Imports
require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const ModuleManager = require('./structures/ModuleManager.js');
const Database = require('./structures/Database.js');
const ConfigurationManager = require('./structures/ConfigurationManager.js');
const Utils = require('./structures/Utils.js');
BigInt.prototype.toJSON = function() { return this.toString() } // MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#use_within_json

// Discord
class BotClient extends Client {
    constructor(options) {
        super(options);

        this.commands = new Collection();
        this.settings = new Collection();
        this.utils = new Utils();
        this.moduleManager = new ModuleManager(this);
        this.config = new ConfigurationManager(this, {
            activity: `/help`,
            owners: ["311929179186790400", "422418878459674624"],
            systemServer: ["1313550337474429001"]
        });

        this.database = new Database(this);
        this.moduleManager.init();
    }
};

const client = new BotClient({ intents: Object.values(GatewayIntentBits).reduce((a, b) => a | b), partials: [Partials.Reaction, Partials.Message] });

client.login(process.env.TOKEN);

module.exports = BotClient;
