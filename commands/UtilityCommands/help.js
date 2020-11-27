let Discord = require("discord.js");
exports.run = async (client, message, args) => {
    if (args < 1) {
        let embed = new Discord.MessageEmbed()
            .setTitle("Help Command List")
            .setDescription(
                client.PluginManager.commands
                    .filter(cmd => !cmd.config.disabled)
                    .map(c => `${c.help.name} - \`${c.help.info}\``)
                    .join("\n")
            )
            .setFooter("Use -help <command> to view help for a specific command.");
        message.channel.send(embed);

        return;
    }

    const command = client.PluginManager.getCommand(args[0]);// client.commands.get(args[0]) || client.commands.find(c => c.config.aliases.includes(args[0]));
    if (!command) return message.channel.send(`:x: Unknown command`);

    const embed1 = new Discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("Description", command.help.info)
        .addField("Usage", `${client.config.prefix}${args[0]} ${command.help.usage}`)
        .addField("Aliases", command.config.aliases.map(a => `\`${a}\``).join(", ") || "None");
    message.channel.send(embed1)
};

exports.help = {
    name: ":grey_question:help",
    info: "See a list of commands or more informations about a command",
    usage: "[command]"
};

exports.config = {
    aliases: [], // Array of aliases
    cooldown: 3 // Command cooldown
};