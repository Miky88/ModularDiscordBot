exports.run = async (client, message, args) => {
    // TODO: .
}

exports.help = {
    name: ':man_astronaut:perms',
    info: 'Sets an user\'s permission level',
    usage: '<user> <level>',
}

exports.config = {
    aliases: [], // Array of aliases
    cooldown: 0, // Command cooldown
    minLevel: 9, // Minimum level require to execute the command
    reqPerms: [], // Array of required user permissions to perform the command
    botPerms: [] // Array of required bot permissions to perform the command
};