const Command = require('../../structures/Command.js');

let { EmbedBuilder, ApplicationCommandOptionType} = require('discord.js');

module.exports = class ModManCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: "modman",
            description: "Manipulate Bot Modules",
            requiredFlag: ["OWNER"],
            cooldown: 3,
            options: [
                {
                    name: "load",
                    description: "Load a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "unload",
                    description: "Unload a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "reload",
                    description: "Reload a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "enable",
                    description: "Enable a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "disable",
                    description: "Disable a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "info",
                    description: "Get information about a module",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Get a list of loaded modules",
                    type: ApplicationCommandOptionType.Subcommand,
                }
            ]
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        let { module } = args
        let Manager = client.moduleManager
        let response
        let embed = new EmbedBuilder()
        .setTitle("Module Manager")
        switch (interaction.options.getSubcommand()) {
            case "load":
                response = await Manager.load(module)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`:white_check_mark: **${module}** succefully loaded`)
                if(!response.error) return await interaction.reply({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to load **${module}**:\`\`\`${response.error}\`\`\``)
                return await interaction.reply({ embeds: [embed] })
            case "unload":
                response = await Manager.unload(module)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`:white_check_mark: **${module}** succefully unloaded`)
                if(response) return await interaction.reply({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to unload **${module}**, is it even loaded?`)
                return await interaction.reply({ embeds: [embed] })
            case "reload":
                response = await Manager.reload(module)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`:white_check_mark: **${module}** succefully reloaded`)
                if(response) return await interaction.reply({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to reload **${module}**, is it even loaded?`)
                return await interaction.reply({ embeds: [embed] })
            case "enable":
                response = await Manager.enable(module)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`:white_check_mark: **${module}** succefully enabled and executed`)
                if(response) return await interaction.reply({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to enable **${module}**, is it even loaded?`)
                return await interaction.reply({ embeds: [embed] })
            case "disable":
                response = await Manager.disable(module)
                embed
                    .setColor(0x00FF00)
                    .setDescription(`:white_check_mark: **${module}** succefully disabled`)
                if(response) return await interaction.reply({ embeds: [embed] })
                embed
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to disable **${module}**, is it even loaded?`)
                return await interaction.reply({ embeds: [embed] })
            case "info":
                response = await Manager.info(module)
                
                embed
                    .setTitle(`Module Manager`)
                    .setColor(0xFF0000)
                    .setDescription(`:x: There was an error trying to fetch informations from **${module}**:\`\`\`${response.error}\`\`\``)
                if(response.error) return await interaction.reply({ embeds: [embed] })
    
                embed
                    .setTitle(`Module Manager - ${module}`)
                    .setColor(0x0000FF)
                    .setDescription(response.description)
                    .addField("Enabled", `${response.enabled}`, true)
                    .addField("Loaded", `${response.loaded}`, true)
                    .addField("Triggering Event", Array.isArray(response.event) ? response.event.join(", ") : response.event, true)
                return await interaction.reply({ embeds: [embed] })
            case "list":
                embed
                    .setTitle("Module Manager")
                    .addFields({name : "Loaded", value: Manager.list.loaded || "_Nothing_", inline: true })
                    .setColor(0x0000FF)
                Manager.list.unloaded ? embed.addField("Unloaded", Manager.list.unloaded, true) : undefined
                await interaction.reply({ embeds: [embed] })
                break;
            default:
                await interaction.reply(`:warning: Correct usage \`plugman (list|load|unload|enable|disable|info) <module name>\``)
                break;
        }
    }
}