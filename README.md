# ModularBot
Discord Modular Bot with Custom Plugin support.

## Making a Plugin
Plugins are stored in plugins/ directory and are loaded into the bot on startup. Enabled plugins are also runned when they get triggered by respective event.
```js
const BasePlugin = require("../base/BasePlugin.js"); // Import the base plugin

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
