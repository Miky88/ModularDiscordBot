// Imports
const Discord = require('discord.js');
require('./modules/Functions.js')
require('dotenv').config()
const PluginManager = require('./modules/PluginManager.js')

// Discord
const client = new Discord.Client();
client.config = require('./config.js');
client.commands = new Discord.Collection();
client.database = require('./modules/Database.js');

// Discord Events and Plugins
client.PluginManager = new PluginManager(client)
client.PluginManager.init()

client.login(client.config.token)