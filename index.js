// Imports
const {Client, Collection} = require('discord.js');
require('./modules/Functions.js');
require('dotenv').config();
const PluginManager = require('./modules/PluginManager.js');
const Database = require('./modules/Database.js');

// Discord
const client = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

client.config = require('./config.js');
client.commands = new Collection();
client.database = new Database(client);

// Discord Events and Plugins
client.PluginManager = new PluginManager(client);
client.PluginManager.init();

client.login(client.config.token);