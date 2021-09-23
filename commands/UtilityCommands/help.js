const Discord = require("discord.js");
const BotClient = require("../..");
const BaseCommand = require('../../modules/BaseCommand')

module.exports = class HelpCommand extends BaseCommand {
    constructor() {
        super({
            name: ":grey_question:help",
            info: "Shows a list of commands or informations about a command",
            usage: "[command]",
            cooldown: 3,
            args: [
                {
                    name: "command",
                    type: "string",
                    default: ""
                }
            ]
        })
    }

    /**
     * @param {BotClient} client 
     * @param {Discord.Message} message 
     * @param {*} args 
     */
    async run(client, message, args) {
        let embed = new Discord.MessageEmbed()
            .setTitle("Help Command List")
            .setDescription(
                client.PluginManager.commands
                    .filter(cmd => !cmd.config.disabled)
                    .map(c => `${c.help.name} - \`${c.help.info}\``)
                    .join("\n")
            )
            .setFooter(`Use ${client.config.prefix}help <command> to view help for a specific command.`);

        if (!args.command) return message.channel.send({ embeds: [embed] });

        const [command, _plugin] = client.PluginManager.getCommand(args.command);
        if (!command) return message.channel.send(`:x: Unknown command`, { embeds: [embed] });

        const commandEmbed = new Discord.MessageEmbed()
            .setColor("RANDOM")
            .addField(":notepad_spiral: Description", command.help.info)
            
        if (command.help.usage?.trim()) commandEmbed.addField(":pencil: Usage", `\`${client.config.prefix}${args.command} ${command.help.usage}\``)
        if (command.config.aliases.length) commandEmbed.addField(":izakaya_lantern: Aliases", command.config.aliases.map(a => `\`${a}\``).join(", ") || "None");
        
        message.channel.send({ embeds: [commandEmbed] })
    }
}