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
        let m = await interaction.reply({ content: this.t('messages.pinging', interaction), withResponse: true });
        interaction.editReply(this.t('messages.pong', interaction, { latency: m.createdTimestamp - interaction.createdTimestamp, apiLatency: Math.round(client.ws.ping) }));
    }
}
