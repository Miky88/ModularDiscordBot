const Command = require('@structures/Command.js');
const PowerLevels = require('@structures/PowerLevels.js');

/**
 * Entry point for the in-Discord module-manager GUI. The actual rendering
 * and routing lives in `modules/System/lib/ModmanUI.js`; this command just
 * opens the panel ephemerally. Bot-OWNER only.
 */
module.exports = class ModmanCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'modman',
            description: 'Manipulate Bot Modules',
            cooldown: 3,
            minLevel: PowerLevels.OWNER
        });
    }

    /**
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async run(client, interaction) {
        await this.module.modmanUI.open(interaction);
    }
};
