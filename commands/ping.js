const BaseCommand = require('../modules/BaseCommand.js');

class Ping extends BaseCommand {
    constructor() {
        super ({
            name: ':ping_pong:ping',
            info: 'Checks if the bot responds',
            aliases: ['pong'],
            cooldown: 3
        });
    }

    /**
     * 
     * @param {import('..')} client 
     * @param {import('discord.js').Message} message 
     * @param {*} args 
     */
    async run(client, message, args) {
        const msg = await message.channel.send('Pong!');
        msg.edit(`:ping_pong:Pong! Latency: \`${msg.createdTimestamp - message.createdTimestamp}ms\`. API Latency: \`${Math.round(client.ws.ping)}ms\``);
    }
}

module.exports = Ping;