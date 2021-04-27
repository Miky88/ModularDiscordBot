// Imports
const Discord = require('discord.js');
require('./modules/Functions.js');
require('dotenv').config();
const PluginManager = require('./modules/PluginManager.js');
const Database = require('./modules/Database.js');

// Discord
const client = new Discord.Client();
client.config = require('./config.js');
client.commands = new Discord.Collection();
client.database = new Database(client);

// Discord Events and Plugins
client.PluginManager = new PluginManager(client);
client.PluginManager.init();

client.login(client.config.token);