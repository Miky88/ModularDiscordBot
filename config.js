module.exports = {
    prefix: "-", // Prefix for bot commands
    token: process.env.TOKEN, // Bot's token
    activity: '-help', // Bot's Status
    owners: ["311929179186790400"], // Bot Owner IDs (For security reasons you can't set this with the setlevel command)
    permissions: [ // Please don't touch level numbers of -1, 0 and 10
        {
            level: '-1',
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
    ]
}