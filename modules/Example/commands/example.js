const Command = require('@structures/Command.js');

module.exports = class ExampleCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'example',
            description: 'See the example config.',
            cooldown: 3
        });
        this.module = module;
    }

    /**
     * 
     * @param {import('../../../index.js')} client 
     * @param {import('discord.js').CommandInteraction} interaction 
     */
    async run(client, interaction) {
        await interaction.reply(`Example String: ${this.module.config.get('exampleString')}\nExample Number: ${this.module.config.get('exampleNumber')}\nExample Array: ${this.module.config.get('exampleArray').join(', ')}\nExample Boolean: ${this.module.config.get('exampleBoolean')}`);
    }
}
