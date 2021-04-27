exports.run = async (client, message, args) => {
    // TODO: .
}

exports.help = {
    name: ':notebook:blacklist',
    info: 'Blacklists an user from the bot',
    usage: '<user> <reason>',
}

exports.config = {
    aliases: [], // Array of aliases
    cooldown: 0, // Command cooldown
    minLevel: 6, // Minimum level require to execute the command
    reqPerms: [], // Array of required user permissions to perform the command
    botPerms: [] // Array of required bot permissions to perform the command
};