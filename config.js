module.exports = {
    prefix: process.env.PREFIX || "-", // Prefix for bot commands
    token: process.env.TOKEN, // Bot's token
    activity: `${process.env.PREFIX || "!"}help`, // Bot's Status
    owners: ["311929179186790400"], // Bot Owner IDs (For security reasons you can't set this with the setlevel command)
    emojis: {
        greenTick: "<:greentick:466238645095890945>",
        redTick: "<:redtick:466238619997175811>",
        yellowTick: "<:yellowtick:517062281805299712>",
        loading: "<a:loading:628968304484286474>"    
    },
    powerlevels: [
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