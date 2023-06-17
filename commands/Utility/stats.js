const Command = require('../../modules/Command.js');

const { version } = require("discord.js");
const moment = require("moment");
require("moment-duration-format");
const { EmbedBuilder } = require('discord.js')

class Stats extends Command {
    constructor() {
        super ({
            name: 'stats',
            setDescription: 'See some fancy bot statistics',
            cooldown: 3
        });
    }

    /**
     * 
     * @param {import('../..')} client 
     * @param {import('discord.js').Message} message 
     * @param {*} args 
     */
    async run(client, message, args) {
        const duration = moment
        .duration(client.uptime)
        .format(" D [days], H [hrs], m [mins], s [secs]");
        const elapsed = moment
            .duration(moment().diff(moment(client.user.createdAt)))
            .format(
                "Y [years], D [days], H [hours], m [minutes] [and] s [seconds] [ago]"
            );

        let embed = new EmbedBuilder()
            .setColor("RANDOM")
            .setTitle("STATISTICS")
            .setDescription(`${client.user.username}`)
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

        message.channel.send({ embeds: [embed] });
    }
}

module.exports = Stats;