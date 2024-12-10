const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType, EmbedBuilder, userMention, User, UserContextMenuCommandInteraction, PermissionsBitField } = require('discord.js');
const { Pagination } = require('pagination.djs');
const Module = require('../../structures/Module.js');

module.exports = class Settings extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'settings',
            defaultMemberPermissions: [PermissionsBitField.Flags.ManageGuild],
            description: 'View, add or remove settings from this guild.',
            options: [
                {
                    name: "view",
                    description: "View the current settings for this server.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to view settings for",
                            type: ApplicationCommandOptionType.String,
                            required: false,
                            // choices: client.settings.map((v, k) => {return {name: k, value: k}})
                        }
                    ],
                },
                {
                    name: "set",
                    description: "Set the value of a key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to set key of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            // choices: client.settings.map((v, k) => {return {name: k, value: k}})
                        },
                        {
                            name: "key",
                            description: "Key to change the value of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        },
                        {
                            name: "value",
                            description: "Value to set the key to",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "add",
                    description: "Add a value to a key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to add key of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            // choices: client.settings.map((v, k) => {return {name: k, value: k}})
                        },
                        {
                            name: "key",
                            description: "Key to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        },
                        {
                            name: "value",
                            description: "Value to add to the key",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "remove",
                    description: "Remove a value from a key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to remove value of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            // choices: client.settings.map((v, k) => {return {name: k, value: k}})
                        },
                        {
                            name: "key",
                            description: "Key to perform action on",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        },
                        {
                            name: "value",
                            description: "Value to remove from the key",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                },
                {
                    name: "reset",
                    description: "Retets the value of a key to it's default value",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "module",
                            description: "Module to set key of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            // choices: client.settings.map((v, k) => {return {name: k, value: k}})
                        },
                        {
                            name: "key",
                            description: "Key to change the value of",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true
                        },
                    ]
                },
            ]
        });
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        const guild = interaction.guild;
        switch (interaction.options.getSubcommand()) {
            case "set": {
                await await this.client.settings.get(interaction.options.getString("module")).set(guild.id, interaction.options.getString("key"), interaction.options.getString("value"));
                const embed = new EmbedBuilder()
                    .setTitle('Value set')
                    .setDescription(`Value \`${interaction.options.getString("value")}\` set for key \`${interaction.options.getString("key")}\``)
                interaction.reply({ embeds: [embed] })
                break;
            } case "add": {
                await this.client.settings.get(interaction.options.getString("module")).add(guild.id, interaction.options.getString("key"), interaction.options.getString("value"));
                const embed = new EmbedBuilder()
                    .setTitle('Value added')
                    .setDescription(`Value \`${interaction.options.getString("value")}\` added to key \`${interaction.options.getString("key")}\``);
                    
                interaction.reply({ embeds: [embed] })
                break;
            } case "remove": {
                await this.client.settings.get(interaction.options.getString("module")).remove(guild.id, interaction.options.getString("key"), interaction.options.getString("value"));
                const embed = new EmbedBuilder()
                    .setTitle('Value removed')
                    .setDescription(`Value \`${interaction.options.getString("value")}\` removed from key \`${interaction.options.getString("key")}\``)
                interaction.reply({ embeds: [embed] })
                break;
            } case "view": {
                const pagination = new Pagination(interaction);
                const embeds = [];

                let settings = client.settings.map((v, k) => {return {module: k, settings: v.get(guild.id).settings}});
                settings.forEach(s => {
                    const embed = new EmbedBuilder()
                       .setTitle(`Settings for ${s.module}`)
                       .setDescription(Object.entries(s.settings).map(([key, value]) => `\`${key}\`: ${Array.isArray(value)? value.join(', ') : value}`).join('\n'))
                    embeds.push(embed);
                });
                if (embeds.length == 0) {
                    const embed = new EmbedBuilder()
                       .setTitle('No settings found')
                       .setDescription('There are no settings to show.')
                       .setColor('Random')
                    embeds.push(embed);
                }
                pagination.setAuthorizedUsers([interaction.user.id])
                pagination.setEmbeds(embeds, (embed, index, array) => {
                    return embed.setFooter({ text: `Page: ${index + 1}/${array.length}` });
                });
                await pagination.render();
                break;
            } case "reset": {
                await this.client.settings.get(interaction.options.getString("module")).reset(guild.id, interaction.options.getString("key"));
                const embed = new EmbedBuilder()
                    .setTitle('Key restored to its default value')
                    .setDescription(`Key \`${interaction.options.getString("key")}\` has been restored to default.`)
                interaction.reply({ embeds: [embed] })
                break;
            }
        }
        
    }
}
