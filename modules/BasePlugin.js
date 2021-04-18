const Discord = require('discord.js');
const fs = require('fs')
class BasePlugin {
    constructor({
        name = null,
        info = "No description provided.",
        enabled = false,
        event = "ready",
        system = false
    }) {
        this.conf = { enabled, event, system };
        this.about = { name, info };
        
        this.commands = new Discord.Collection()
        this.loadCommands = async () => {
            const commands = fs.existsSync(`./commands/${name}`) ? fs.readdirSync(`./commands/${name}`).filter(file => file.endsWith(".js")) : [];
            commands.forEach(file => {
                this.commands.set(file.split(".")[0], require(`../commands/${name}/${file}`))
                console.log(`[Plugin Manager] Loaded command ${file} from ${name}`)
            });    
        }
    }
}
module.exports = BasePlugin;