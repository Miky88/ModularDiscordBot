module.exports = {
    prefix: process.env.PREFIX || "-", // Prefix for bot commands
    token: process.env.TOKEN, // Bot's token
    activity: `/help`, // Bot's Status
    owners: ["311929179186790400", "422418878459674624"], // Bot Owner IDs (For security reasons you can't set this with the setlevel command)
    systemServer: "633332682578853905", // Server ID where the bot will load system commands
    emojis: {
        greenTick: "<:greentick:466238645095890945>",
        redTick: "<:redtick:466238619997175811>",
        yellowTick: "<:yellowtick:517062281805299712>",
        loading: "<a:loading:628968304484286474>"    
    },
    powerlevels: [
        {
            level: -1,
            name: 'Blacklisted',
            icon: ':white_square_button:',
            description: 'Users that are blacklisted from the bot'
        },
        {
            level: 0,
            name: 'User',
            icon: ':small_blue_diamond:',
            description: 'Everyone that is not a bot is an user'
        },
        {
            level: 6,
            name: 'Bot Mod',
            icon: ':police_officer:',
            description: 'Bot Mods are people empowered by the bot\'s owner and they got access to privileged moderation commands'
        },
        {
            level: 9,
            name: 'Bot Admin',
            icon: ':sparkles:',
            description: 'Bot Admins are people empowered by the bot\'s owner and they got access to privileged administration commands'
        },
        {
            level: 10,
            name: 'Bot Owner',
            icon: ':star2:',
            description: 'Bot\'s Owner has full control of the bot and access to all privileged commands'
        }
    ],
    guildlevels: [
        {
            level: -1,
            name: 'Blacklisted',
            icon: ':white_square_button:',
            description: 'Users that are blacklisted from the bot'
        },
        {
            level: 0,
            name: 'Member',
            icon: ':small_blue_diamond:',
            description: 'Everyone that is not a bot is a user'
        },
        {
            level: 7,
            name: 'Helper',
            icon: ':student:',
            description: 'Helpers help Moderators in keeping the server clean'
        },
        {
            level: 8,
            name: 'Moderator',
            icon: ':police_officer:',
            description: 'Moderators keep the server in order through moderative actions'
        },
        {
            level: 9,
            name: 'Admin',
            icon: ':sparkles:',
            description: 'Admins are responsible for important administration tasks'
        },
        {
            level: 10,
            name: 'Server Owner',
            icon: ':star2:',
            description: 'The server owner has full control over the server and its members'
        }   
    ]
}