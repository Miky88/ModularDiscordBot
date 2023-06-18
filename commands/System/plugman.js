const Command = require('../../structures/Command.js');

let { EmbedBuilder, ApplicationCommandOptionType} = require('discord.js');
let { emojis } = require('../../config.js');

class PlugMan extends Command {
    constructor() {
        super ({
            name: "plugman",
            description: "Manipulate Bot Plugins",
            minLevel: 9,
            cooldown: 3,
            options: [
                {
                    name: "action",
                    description: "Action to perform",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: ["load", "unload", "reload", "enable", "disable", "info", "list"].map(c => ({ name: c, value: c }))
                },
                {
                    name: "plugin",
                    description: "Plugin to perform action on",
                    type: ApplicationCommandOptionType.String,
                    required: false
                }
            ]
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').Message} message 
     * @param {*} args 
     */
    async run(client, message, args) {
        let { action, pluginName } = args
        let Manager = client.pluginManager
        let response
        let embed = new EmbedBuilder()
        .setTitle("Plugin Manager")
        .setFooter("PluginManager "+ process.env.PLUGMAN_VERSION)
        switch (action) {
            case "load":
                response = await Manager.load(pluginName)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`${emojis.greenTick} **${pluginName}** succefully loaded`)
                if(!response.error) return message.channel.send({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to load **${pluginName}**:\`\`\`${response.error}\`\`\``)
                return message.channel.send({ embeds: [embed] })
            case "unload":
                response = await Manager.unload(pluginName)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`${emojis.greenTick} **${pluginName}** succefully unloaded`)
                if(response) return message.channel.send({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to unload **${pluginName}**, is it even loaded?`)
                return message.channel.send({ embeds: [embed] })
            case "reload":
                response = await Manager.reload(pluginName)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`${emojis.greenTick} **${pluginName}** succefully reloaded`)
                if(response) return message.channel.send({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to reload **${pluginName}**, is it even loaded?`)
                return message.channel.send({ embeds: [embed] })
            case "enable":
                response = await Manager.enable(pluginName)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`${emojis.greenTick} **${pluginName}** succefully enabled and executed`)
                if(response) return message.channel.send({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to enable **${pluginName}**, is it even loaded?`)
                return message.channel.send({ embeds: [embed] })
            case "disable":
                response = await Manager.disable(pluginName)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`${emojis.greenTick} **${pluginName}** succefully disabled`)
                if(response) return message.channel.send({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to disable **${pluginName}**, is it even loaded?`)
                return message.channel.send({ embeds: [embed] })
            case "info":
                response = await Manager.info(pluginName)
                
                embed
                    .setTitle(`Plugin Manager`)
                    .setColor(0xFF0000)
                    .setDescription(`${emojis.redTick} There was an error trying to fetch informations from **${pluginName}**:\`\`\`${response.error}\`\`\``)
                if(response.error) return message.channel.send({ embeds: [embed] })
    
                embed
                    .setTitle(`Plugin Manager - ${pluginName}`)
                    .setColor(0x0000FF)
                    .setDescription(response.description)
                    .addField("Enabled", `${response.enabled}`, true)
                    .addField("Loaded", `${response.loaded}`, true)
                    .addField("Triggering Event", Array.isArray(response.event) ? response.event.join(", ") : response.event, true)
                return message.channel.send({ embeds: [embed] })
            case "list":
                embed
                    .setTitle("Plugin Manager")
                    .addField("Loaded", Manager.list.loaded || "_Valore vuoto_", true)
                    .setColor(0x0000FF)
                Manager.list.unloaded ? embed.addField("Unloaded", Manager.list.unloaded, true) : undefined
                message.channel.send({ embeds: [embed] })
                break;
            default:
                message.channel.send(`${emojis.yellowTick} Correct usage \`plugman (list|load|unload|enable|disable|info) <plugin name>\``)
                break;
        }
    }
}

module.exports = PlugMan;