const InteractionCommand = require('../modules/InteractionCommand');

module.exports = class Userinfo extends InteractionCommand {
    constructor() {
        super ({
            name: 'userinfo',
            type: 'USER'
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