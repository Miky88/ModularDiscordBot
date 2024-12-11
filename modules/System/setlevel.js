const Command = require('../../structures/Command.js');
const { ApplicationCommandOptionType, EmbedBuilder, userMention, User, UserContextMenuCommandInteraction } = require('discord.js');
const PowerLevels = require('../../structures/PowerLevels.js');

module.exports = class SetLevelCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'setlevel',
            description: 'Set a user\'s powerlevel',
            minLevel: PowerLevels.ADMIN,
            options: [
                {
                    name: "user",
                    description: "User to perform action on",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "level",
                    description: "Level to set",
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                    choices: Object.entries(PowerLevels).slice(1).map(c => ({ name: c[0], value: c[1] })) // omit OWNER
                }
            ]
        });
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        let level = interaction.options.getInteger('level');
        let user = interaction.options.getUser('user');

        const data = await client.database.forceUser(user.id);
        if (!data) return await interaction.reply(":warning: There's no user in database matching your query");
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return;

        if (interaction.user.data.powerlevel <= data.powerlevel)
            return await interaction.reply(":x: You can't set this user's powerlevel.");

        data.powerlevel = level;

        try {
            await client.database.updateUser(data);
            return await interaction.reply(`:white_check_mark: Successfully set powerlevel for ${user.displayName} to: ${Object.entries(PowerLevels).find(l => l[1] == level)[0]}`);
        } catch (e) {
            console.error(e);
            return await interaction.reply(":x: An internal error occurred");
        }
    }
}
