# ModularBot
Discord Modular Bot with Custom Plugin support.
## Installation
1. Clone or download the repository
2. Run `npm install` on the repo's folder
3. Rename `.env.example` in `.env`
4. Replace `YourBotToken` with your bot's token in `.env` file
5. Change the settings in `config.js` file
6. Try the bot by executing `node index.js` in the repo's folder
If you have troubles just open an issue!

## Making a Plugin
Plugins are stored in plugins/ directory and are loaded into the bot on startup. Enabled plugins are also runned when they get triggered by respective event.
```js
const Plugin = require("../modules/Plugin.js"); // Import the base plugin

class Example extends Plugin {
    constructor() {
        super({
            name: "Example", // Name of the plugin
            info: "Description", // Description of the plugin
            enabled: true, // Defines if this plugin would be enabled on startup
            event: "ready" // Event that triggeres the plugin
        })
    }

    async run(client, ...args) { // args are the arguments of Discord.js Events (es. for presenceUpdate you would have [oldPresence, newPresence]
        this.log("Hi!")
    }
}

module.exports = Example;
```
