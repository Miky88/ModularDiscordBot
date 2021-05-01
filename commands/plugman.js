let Discord = require('discord.js')
let Emojis = require('../modules/Emojis.js')

exports.run = async (client, message, args) => {
    let [action, pluginName] = args
    let Manager = client.PluginManager
    let response
    let embed = new Discord.MessageEmbed()
    .setTitle("Plugin Manager")
    .setFooter("PluginManager "+ process.env.PLUGMAN_VERSION)
    switch (action) {
        case "load":
            response = await Manager.load(pluginName)
            embed
                .setColor(0x00FF00)
                .setDescription(`${Emojis.greenTick} **${pluginName}** succefully loaded`)
            if(!response.error) return message.channel.send(embed)
            embed
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to load **${pluginName}**:\`\`\`${response.error}\`\`\``)
            return message.channel.send(embed)
        case "unload":
            response = await Manager.unload(pluginName)
            embed
                .setColor(0x00FF00)
                .setDescription(`${Emojis.greenTick} **${pluginName}** succefully unloaded`)
            if(response) return message.channel.send(embed)
            embed
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to unload **${pluginName}**, is it even loaded?`)
            return message.channel.send(embed)
        case "reload":
            response = await Manager.reload(pluginName)
            embed
                .setColor(0x00FF00)
                .setDescription(`${Emojis.greenTick} **${pluginName}** succefully reloaded`)
            if(response) return message.channel.send(embed)
            embed
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to reload **${pluginName}**, is it even loaded?`)
            return message.channel.send(embed)
        case "enable":
            response = await Manager.enable(pluginName)
            embed
                .setColor(0x00FF00)
                .setDescription(`${Emojis.greenTick} **${pluginName}** succefully enabled and executed`)
            if(response) return message.channel.send(embed)
            embed
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to enable **${pluginName}**, is it even loaded?`)
            return message.channel.send(embed)
        case "disable":
            response = await Manager.disable(pluginName)
            embed
                .setColor(0x00FF00)
                .setDescription(`${Emojis.greenTick} **${pluginName}** succefully disabled`)
            if(response) return message.channel.send(embed)
            embed
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to disable **${pluginName}**, is it even loaded?`)
            return message.channel.send(embed)
        case "info":
            response = await Manager.info(pluginName)
            
            embed
                .setTitle(`Plugin Manager`)
                .setColor(0xFF0000)
                .setDescription(`${Emojis.redTick} There was an error trying to fetch informations from **${pluginName}**:\`\`\`${response.error}\`\`\``)
            if(response.error) return message.channel.send(embed)
            embed
                .setTitle(`Plugin Manager - ${pluginName}`)
                .setColor(0x0000FF)
                .setDescription(response.description)
                .addField("Enabled", response.enabled, true)
                .addField("Loaded", response.loaded, true)
                .addField("Triggering Event", response.event, true)            
            return message.channel.send(embed)
        case "list":
            embed
                .setTitle("Plugin Manager")
                .addField("Loaded", Manager.list.loaded, true)
                .setColor(0x0000FF)
            Manager.list.unloaded ? embed.addField("Unloaded", Manager.list.unloaded, true) : undefined
            message.channel.send(embed)
            break;
        default:
            message.channel.send(`${Emojis.yellowTick} Correct usage \`plugman (list|load|unload|enable|disable|info) <plugin name>\``)
            break;
    }
};

exports.help = {
    name: ":gear:plugman",
    info: "Manipulate Bot Plugins",
    usage: "(load|unload|enable|disable|info|list) [<plugin name>]"
};

exports.config = {
    aliases: ["plugin","pluginmanager","pman"], // Array of aliases
    cooldown: 3, // Command cooldown
    minLevel: 9, // Minimum level require to execute the command
    reqPerms: [], // Array of required user permissions to perform the command
    botPerms: [] // Array of required bot permissions to perform the command
};