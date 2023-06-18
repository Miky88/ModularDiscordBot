const Command = require('../../modules/Command.js');

const { emojis } = require('../../config.js');

class Reboot extends Command {
    constructor() {
        super ({
            name: 'reboot',
            description: 'Reboots the bot if running under PM2',
            minLevel: 9
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {*} args 
     */
    async run(client, interaction, args) {
        const { promisify } = require("util");
        const write = promisify(require("fs").writeFile);
        const m = await interaction.reply(emojis.loading + " Rebooting...");
        await write('./reboot.json', `{"id": "${m.id}", "channel": "${m.channel.id}"}`).catch(console.error);
        
        process.exit(1);
    }
}

module.exports = Reboot;