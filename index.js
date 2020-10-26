// Imports
const Discord = require('discord.js');
const fs = require('fs')
require('./base/Functions.js')
require('dotenv').config()
//const PluginLoader = require('./base/PluginLoader.js')
const PluginManager = require('./base/PluginManager.js')

// Discord
const client = new Discord.Client();
client.config = require('./config.js');
client.commands = new Discord.Collection();
//client.plugins = new Discord.Collection();

// Discord Events and Plugins
//client.Loader = new PluginLoader(client)
//client.Loader.init(client)
client.PluginManager = new PluginManager(client)
client.PluginManager.init()

// Discord Commands
const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
commandFiles.forEach(file => {
  const command = require(`./commands/${file}`);
  const commandName = file.split(".")[0];
  client.commands.set(commandName, command);
});

client.login(client.config.token)