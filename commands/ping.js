const InteractionCommand = require('../modules/InteractionCommand');

module.exports = class Ping extends InteractionCommand {
    constructor() {
        super ({
            name: 'ping',
            description: 'Checks if the bot responds',
            cooldown: 3
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').CommandInteraction} interaction 
     * @param {*} args
     */
    async run(client, interaction, args) {
        await interaction.reply("Pong!")
    }
}