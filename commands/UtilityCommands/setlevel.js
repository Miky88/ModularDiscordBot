exports.run = async (client, message, args) => {

}

exports.help = {
    name: ':magic_wand:setlevel',
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