const Command = require('@core/Command.js');
const { ApplicationCommandOptionType, EmbedBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const { Pagination } = require('pagination.djs');

module.exports = class Settings extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'settings',
            description: 'View, add or remove settings from this guild.',
            defaultMemberPermissions: [PermissionsBitField.Flags.ManageGuild],
            guildOnly: true,
            options: [
                {
                    name: "view",
                    description: "View the current settings for this server.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "module", description: "Module to view settings for", type: ApplicationCommandOptionType.String, required: false, autocomplete: true }
                    ]
                },
                {
                    name: "set",
                    description: "Set the value of a key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "module", description: "Module to set key of",   type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "key",    description: "Key to change",          type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "value",  description: "Value to set",           type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: "add",
                    description: "Add a value to an array key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "module", description: "Module",                 type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "key",    description: "Array key",              type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "value",  description: "Value to add",           type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: "remove",
                    description: "Remove a value from an array key",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "module", description: "Module",                 type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "key",    description: "Array key",              type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "value",  description: "Value to remove",        type: ApplicationCommandOptionType.String, required: true }
                    ]
                },
                {
                    name: "reset",
                    description: "Reset a key to its default value",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "module", description: "Module",                 type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                        { name: "key",    description: "Key to reset",           type: ApplicationCommandOptionType.String, required: true, autocomplete: true }
                    ]
                }
            ]
        });
    }

    /**
     * @param {import('../../../index.js')} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async run(client, interaction) {
        const guild = interaction.guild;
        const actor = interaction.member;
        const sub = interaction.options.getSubcommand();
        const moduleName = interaction.options.getString("module");
        const key = interaction.options.getString("key");
        const value = interaction.options.getString("value");

        const manager = moduleName ? client.settings.get(moduleName) : null;
        if (sub !== 'view' && !manager) {
            return interaction.reply({ content: `:x: No settings registered for module \`${moduleName}\`.`, flags: MessageFlags.Ephemeral });
        }

        try {
            switch (sub) {
                case "set": {
                    const coerced = manager.set(guild.id, key, value, { actor });
                    const embed = new EmbedBuilder()
                        .setTitle(this.t('embeds.set.title', interaction))
                        .setDescription(this.t('embeds.set.description', interaction, { key, value: this._format(coerced) }));
                    return interaction.reply({ embeds: [embed] });
                }
                case "add": {
                    const arr = manager.add(guild.id, key, value, { actor });
                    const embed = new EmbedBuilder()
                        .setTitle(this.t('embeds.add.title', interaction))
                        .setDescription(this.t('embeds.add.description', interaction, { key, value: this._format(arr) }));
                    return interaction.reply({ embeds: [embed] });
                }
                case "remove": {
                    const arr = manager.remove(guild.id, key, value, { actor });
                    const embed = new EmbedBuilder()
                        .setTitle(this.t('embeds.remove.title', interaction))
                        .setDescription(this.t('embeds.remove.description', interaction, { key, value: this._format(arr) }));
                    return interaction.reply({ embeds: [embed] });
                }
                case "reset": {
                    const reset = manager.reset(guild.id, key, { actor });
                    const embed = new EmbedBuilder()
                        .setTitle(this.t('embeds.reset.title', interaction))
                        .setDescription(this.t('embeds.reset.description', interaction, { key, value: this._format(reset) }));
                    return interaction.reply({ embeds: [embed] });
                }
                case "view": {
                    return this._view(interaction, moduleName);
                }
            }
        } catch (err) {
            return interaction.reply({ content: `:x: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    }

    async _view(interaction, moduleNameFilter) {
        const client = this.client;
        const guild = interaction.guild;
        const pagination = new Pagination(interaction);
        const embeds = [];

        const targets = moduleNameFilter
            ? [[moduleNameFilter, client.settings.get(moduleNameFilter)]].filter(([, v]) => v)
            : [...client.settings.entries()];

        for (const [name, manager] of targets) {
            const record = manager.get(guild.id);
            const schema = manager.schema;
            const lines = Object.entries(schema).map(([k, def]) => {
                const v = record.settings[k];
                return `\`${k}\`: ${this._format(v)} — \`${def.type}\``;
            });
            const embed = new EmbedBuilder()
                .setTitle(this.t('embeds.view.settings', interaction, { module: name }))
                .setDescription(lines.length ? lines.join('\n') : '_(no keys)_');
            embeds.push(embed);
        }

        if (embeds.length === 0) {
            embeds.push(new EmbedBuilder()
                .setTitle(this.t('embeds.view.nosettings.title', interaction))
                .setDescription(this.t('embeds.view.nosettings.description', interaction))
                .setColor('Random'));
        }

        pagination.setAuthorizedUsers([interaction.user.id]);
        pagination.setEmbeds(embeds, async (embed, index, array) => {
            return embed.setFooter({ text: this.t('embeds.view.page', interaction, { page: index + 1, totalPages: array.length }) });
        });
        await pagination.render();
    }

    _format(v) {
        if (v == null) return '_unset_';
        if (Array.isArray(v)) return v.length ? v.map(x => `\`${x}\``).join(', ') : '_empty_';
        if (typeof v === 'boolean') return v ? '`true`' : '`false`';
        return `\`${v}\``;
    }
}
