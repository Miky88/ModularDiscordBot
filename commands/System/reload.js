const Command = require('../../structures/Command');
const { ApplicationCommandOptionType } = require('discord.js');

module.exports = class ReloadCommand extends Command {
    constructor() {
        super({
            name: 'reload',
            description: 'Reloads a command',
            cooldown: 3,
            minLevel: 9,
            options: [
                {
                    name: "command",
                    description: "Command to reload",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                }
            ]
        })
    }

    async run(client, interaction, args) {
        const commandName = args.command
        try {
            const [_, module] = client.moduleManager.getCommand(commandName);
            client.moduleManager.reload(module.about.name);
            await interaction.reply(`:white_check_mark: Command \`${commandName}\` and module \`${module.about.name}\` have been reloaded`)
        } catch (error) {
            if (error.code == "MODULE_NOT_FOUND")
                return await interaction.reply(`:x: Command \`${commandName}\` does not exist or it's not in the same directory of this reload command, if you were trying to reload a module just reload it with the \`plugman\` command`)

            await interaction.reply(`:x: An error occured while reloading the command:
        \`\`\`${error.name}: ${error.message}\`\`\``)
        }
    }
}