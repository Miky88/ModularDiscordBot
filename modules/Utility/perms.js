let { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js')
const Command = require('../../structures/Command.js');
const PowerLevels = require('../../structures/PowerLevels.js');

module.exports = class PermsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'perms',
            description: 'Shows yours or another user\'s perms',
            minLevel: PowerLevels.BLACKLISTED,
            options: [
                {
                    name: "user",
                    description: "User to get perms from",
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        })
    }

    /**
     * 
     * @param {import('../../index.js')} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async run(client, interaction) {
        let user = interaction.options.getUser("user");
        if (!user) user = interaction.user;

        const data = await client.database.forceUser(user.id);
        if (!data) return await interaction.reply(await this.t('messages.nouserindb', interaction));
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return;

        const embed = new EmbedBuilder()
            .setTitle(`${user.discriminator ? user.tag : user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields([
                {
                    name: "Power Level",
                    value: `${Object.entries(PowerLevels).find(l => l[1] == data.powerlevel)[0]}`
                },
            ])
            // .setDescription(`todo`)
            .setColor("Random")

        await interaction.reply({ embeds: [embed] });
    }
}
