let { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js')
const Command = require('../../structures/Command.js');

module.exports = class PermsCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'perms',
            description: 'Shows yours or another user\'s permission levels',
            minLevel: -1,
            options: [
                {
                    name: "user",
                    description: "User to get levels from",
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        })
    }

    async run(client, interaction) {
        let user = interaction.options.getUser("user");
        if (!user) user = interaction.user;

        const data = await client.database.forceUser(user.id)
        if (!data) return await interaction.reply(`${yellowtick} There's no user in database matching your query`)
        if (interaction.user.data.powerlevel < 0 && data.user.id !== interaction.user.id) return;

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => {});

        let perms;

        for (const perm of member.permissions.toArray()) {
            // this sucks but it works
            const rawPermStr = perm.split(/(?=[A-Z])/);
            const lowerCaseStr = rawPermStr.slice(1).join(" ").toLowerCase();
            const permStr = `${rawPermStr[0]} ${lowerCaseStr}`;
    
            perms += `\n• ${permStr}`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${user.discriminator ? user.tag : user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields([
                {
                    name: "Flags",
                    value: `todo` // TODO
                },
                {
                    name: "Server Perms",
                    value: `${member ? perms : "Not a server member"}`
                }
            ])
            // .setDescription(`todo`)
            .setColor("Random")

        await interaction.reply({ embeds: [embed] });
    }
}
