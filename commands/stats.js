const { version } = require("discord.js");
const moment = require("moment");
require("moment-duration-format");
const Discord = require('discord.js')
exports.run = async (client, message, args) => {
    const duration = moment
        .duration(client.uptime)
        .format(" D [days], H [hrs], m [mins], s [secs]");
    const elapsed = moment
        .duration(moment().diff(moment(client.user.createdAt)))
        .format(
            "Y [years], D [days], H [hours], m [minutes] [and] s [seconds] [ago]"
        );

    let embed = new Discord.MessageEmbed()
        .setColor("RANDOM")
        .setTitle("STATISTICS")
        .setDescription(`${client.user.username} v88`)
        .setFooter("Stole by a Samplasion code")
        .addFields(
            {
                name: "⚙️ Memory Usage",
                value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
                inline: true
            },
            { name: "⏱️ Uptime", value: duration, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            {
                name: "🔢 Versions",
                value: `**• Discord.js**: v${version}
**• Node.js**:    ${process.version}`,
                inline: true
            },
            { name: "🎂 Creation date", value: elapsed, inline: false }
        );

    message.channel.send(embed);
};

exports.help = {
    name: ":bar_chart:stats",
    info: "See some fancy bot statistics",
    usage: "",
};

exports.config = {
    aliases: ["status","state"], // Array of aliases
    cooldown: 3, // Command cooldown
};

