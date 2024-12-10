const Command = require('../../structures/Command.js');

module.exports = class PingCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'ping',
            description: 'Checks if the bot responds',
            cooldown: 3
        });
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async run(client, interaction) {
        let m = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        interaction.editReply(`:ping_pong: Pong! Latency is **${m.createdTimestamp - interaction.createdTimestamp}ms**. API Latency is **${Math.round(client.ws.ping)}ms**`);
    }
}
