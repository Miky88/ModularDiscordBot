const Command = require('@structures/Command.js');
const { PermissionsBitField } = require('discord.js');

/**
 * Entry point for the in-Discord settings GUI. Rendering and routing live in
 * `modules/Utility/lib/SettingsUI.js`; this command just opens the panel
 * ephemerally. Per-key access can be further restricted by an admin via
 * `/permissions → Setting overrides`.
 */
module.exports = class SettingsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'settings',
            description: 'View or edit per-guild settings.',
            defaultMemberPermissions: [PermissionsBitField.Flags.ManageGuild]
        });
    }

    /**
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async run(client, interaction) {
        await this.module.settingsUI.open(interaction);
    }
};
