# ModularBot
Discord Modular Bot with Custom Module support.
## Installation
1. Clone or download the repository
2. Run `npm install` on the repo's folder
3. Rename `.env.example` in `.env`
4. Replace `YourBotToken` with your bot's token in `.env` file
5. Change the settings in `config.js` file
6. Try the bot by executing `node index.js` in the repo's folder
If you have troubles just open an issue!

## Making a Module
Plugins are stored in modules/ directory and are loaded into the bot on startup. Enabled modules are also runned when they get triggered by respective event.
```js
const Module = require("../structures/Module.js"); // Import the base module

class Example extends Module {
    constructor(client) {
        super(client, {
            name: "Example", // Name of the module
            info: "Description", // Description of the module
            enabled: true, // Defines if this module would be enabled on startup
            events: ["ready"] // Event that triggeres the module (can be more than one)
        })
    }

    async ready(client, ...args) { // args are the arguments of Discord.js Events (es. for presenceUpdate you would have [oldPresence, newPresence]
        this.logger.log("Hi!")
    }
}

module.exports = Example;
```

## Star History

<a href="https://star-history.com/#Just1diaxx/ModularDiscordBot&Timeline">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Just1diaxx/ModularDiscordBot&type=Timeline&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Just1diaxx/ModularDiscordBot&type=Timeline" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Just1diaxx/ModularDiscordBot&type=Timeline" />
 </picture>
</a>
