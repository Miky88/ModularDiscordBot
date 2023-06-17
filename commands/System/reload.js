const Command = require('../../modules/Command');

module.exports = class ReloadCommand extends Command {
    constructor() {
        super({
            name: ':arrows_counterclockwise:reload',
            description: 'Reloads a command',
            cooldown: 3,
            minLevel: 9,
            options: [
                {
                    name: "command",
                    description: "Command to reload",
                    type: "STRING",
                    required: true,
                }
            ]
        })
    }

    async run(client, message, args) {
        const commandName = args.command
        try {
            const [_, plugin] = client.pluginManager.getCommand(commandName);
            client.pluginManager.reload(plugin.about.name);
            message.channel.send(`:white_check_mark: Command \`${commandName}\` and plugin \`${plugin.about.name}\` have been reloaded`)
        } catch (error) {
            if (error.code == "MODULE_NOT_FOUND")
                return message.channel.send(`:x: Command \`${commandName}\` does not exist or it's not in the same directory of this reload command, if you were trying to reload a plugin just reload it with the \`plugman\` command`)

            message.channel.send(`:x: An error occured while reloading the command:
        \`\`\`${error.name}: ${error.message}\`\`\``)
        }
    }
}