const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType, MessageFlags } = require('discord.js');

module.exports = class SetLangCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'setlang',
            description: 'Set your preferred language for the bot',
            cooldown: 3,
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'language',
                    description: 'The language you want to set',
                    required: true,
                    autocomplete: true
                }
            ]
        });
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async run(client, interaction) {
        const lang = interaction.options.getString('language');
        if (!Object.keys(client.i18n.languages || {}).concat(['default']).includes(lang)) {
            return interaction.reply({ content: await this.t('messages.invalidLang', interaction), flags: [MessageFlags.Ephemeral] });
        }
        const user = await client.database.getUser(interaction.user.id) || await client.database.addUser(interaction.user.id);
        user.language = lang === 'default' ? null : lang;
        client.database.updateUser(user);
        if (lang !== 'default')
            interaction.reply({ content: await this.t('messages.success', interaction), flags: [MessageFlags.Ephemeral] });
        else
            interaction.reply({ content: await this.t('messages.reset', interaction), flags: [MessageFlags.Ephemeral] });
    }
}
