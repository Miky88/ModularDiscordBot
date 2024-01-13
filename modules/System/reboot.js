const Command = require('../../structures/Command.js');

module.exports = class RebootCommand extends Command {
    constructor(client) {
        super(client, {
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
        const m = await interaction.reply(":hourglass_flowing_sand: Rebooting...");
        await write('./reboot.json', `{"id": "${m.id}", "channel": "${m.channel.id}"}`).catch(this.logger.error);
        
        process.exit(1);
    }
}