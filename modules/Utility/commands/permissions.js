const Command = require('@core/Command.js');
const { PermissionsBitField } = require('discord.js');

/**
 * Entry point for the in-Discord permissions GUI. The actual rendering and
 * routing lives in `modules/Utility/lib/PermissionsUI.js`; this command just
 * opens the panel ephemerally.
 */
module.exports = class PermissionsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'permissions',
            description: 'Manage per-guild permission levels and role bindings.',
            guildOnly: true,
            defaultMemberPermissions: [PermissionsBitField.Flags.Administrator]
        });
    }

    /**
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async run(client, interaction) {
        await this.module.permissionsUI.open(interaction);
    }
}
