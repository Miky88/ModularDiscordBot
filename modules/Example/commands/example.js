const Command = require('@structures/Command.js');

module.exports = class ExampleCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'example',
            description: 'See the example config and this server\'s example settings.',
            cooldown: 3
        });
        this.module = module;
    }

    /**
     *
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').CommandInteraction} interaction
     */
    async run(client, interaction) {
        const config = [
            `Example String: ${this.module.config.get('exampleString')}`,
            `Example Number: ${this.module.config.get('exampleNumber')}`,
            `Example Array: ${this.module.config.get('exampleArray').join(', ')}`,
            `Example Boolean: ${this.module.config.get('exampleBoolean')}`
        ].join('\n');

        // Per-guild settings from the SettingsManager (edited via /settings).
        const mgr = this.module.settings;
        const record = mgr.get(interaction.guild.id);
        const settings = mgr.keys()
            .map(key => `\`${key}\` = ${this._format(record.settings[key])}`)
            .join('\n');

        await interaction.reply(`**Config (per-module)**\n${config}\n\n**Settings (this server)**\n${settings}`);
    }

    /** Render a setting value for display. */
    _format(v) {
        if (v == null || v === '') return '_(unset)_';
        if (Array.isArray(v)) return v.length ? v.map(x => `\`${x}\``).join(', ') : '_(empty)_';
        return `\`${v}\``;
    }
}
