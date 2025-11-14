const { MessageFlags } = require('discord.js');
const Command = require('../../structures/Command.js');
const PowerLevels = require("../../structures/PowerLevels.js");

module.exports = class RebootCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'reboot',
            description: 'Reboots the bot if running under PM2',
            minLevel: PowerLevels.ADMIN
        });
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        const { promisify } = require("util");
        const write = promisify(require("fs").writeFile);
        if (!interaction.replied) await interaction.reply({ flags: [MessageFlags.Ephemeral], content: "OK" });
        const m = await interaction.channel.send(this.t("messages.rebooting", interaction));
        await write('./reboot.json', `{"id": "${m.id}", "channel": "${m.channel.id}"}`).catch(this.logger.error);
        
        process.exit(1);
    }
}
