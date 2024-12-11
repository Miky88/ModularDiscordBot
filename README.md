# ModularBot
Discord Modular Bot with Custom Module support.
## Installation
1. Clone or download the repository
2. Run `npm install` on the repo's folder
3. Rename `.env.example` in `.env`
4. Replace `YourBotToken` with your bot's token in `.env` file
5. Change the settings in `config.js` file
6. Try the bot by executing `node index.js` in the repo's folder
If you have troubles just open an issue or join my Discord server https://discord.gg/SJgMCrd

## Making a Module
Modules are stored in modules/ directory and are loaded into the bot on startup. Enabled modules are executed when they get triggered by respective events.
```js
const Module = require("../structures/Module.js"); // Import the base module

class Example extends Module {
    constructor(client) {
        super(client, {
            name: "Example", // Name of the module
            info: "Description", // Description of the module
            enabled: true, // Defines if this module should be enabled on startup
            events: ["ready"], // Event that triggeres the module (can be more than one)
            config: { // Default module configuration, it will be stored in a config.yml inside module directory
                myOptions: {
                    configurableString: "Hey!",
                    configurableList: ["This", "is", "crazy!"]
                }
            },
            settings: { // Default module settings. Can be modified per-guild with the /settings command
                myDouble: 10.1,
                myList: ["Hello", "world!"],
                myString: "Hi!"
            }
        })
    }

    async ready(client, ...args) { // args are the arguments of Discord.js Events (es. for presenceUpdate you would have [oldPresence, newPresence]
        this.logger.log("Hi!")
    }
}

module.exports = Example;
```
