# Dev branch warning
This is a development branch that's still unfinished and running with an unstable Discord.js Dev version.

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
const BasePlugin = require("../modules/BasePlugin.js"); // Import the base plugin

class Example extends BasePlugin {
    constructor() {
        super({
            name: "Example", // Name of the plugin
            info: "Description", // Description of the plugin
            enabled: true, // Defines if this plugin would be enabled on startup
            event: "ready" // Event that triggeres the plugin
        })
    }

    async run(client, ...args) { // args are the arguments of Discord.js Events (es. for presenceUpdate you would have [oldPresence, newPresence]
        console.log("Hi!")
    }
}

module.exports = Example;
```
