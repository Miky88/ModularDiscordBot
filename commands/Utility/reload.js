const BaseCommand = require('../../modules/BaseCommand')

module.exports = class ReloadCommand extends BaseCommand {
    constructor() {
        super({
            name: ':arrows_counterclockwise:reload',
            info: 'Reloads a command',
            usage: '<command>',
            cooldown: 3,
            minLevel: 9,
            args: [
                {
                    name: "command",
                    type: "string"
                }
            ]
        })
    }

    async run(client, message, args) {
        const commandName = args.command
        try {
            const [_, plugin] = client.PluginManager.getCommand(commandName);
            client.PluginManager.reload(plugin.about.name);
            message.channel.send(`:white_check_mark: Command \`${commandName}\` and plugin \`${plugin.about.name}\` have been reloaded`)
        } catch (error) {
            if (error.code == "MODULE_NOT_FOUND")
                return message.channel.send(`:x: Command \`${commandName}\` does not exist or it's not in the same directory of this reload command, if you were trying to reload a plugin just reload it with the \`plugman\` command`)

            message.channel.send(`:x: An error occured while reloading the command:
        \`\`\`${error.name}: ${error.message}\`\`\``)
        }
    }
}