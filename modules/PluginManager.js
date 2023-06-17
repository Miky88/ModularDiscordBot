const { emojis } = require('../config.js');
const fs = require('fs');
const BasePlugin = require('./BasePlugin');
const Command = require('./Command.js');

class PluginManager {
    constructor(client) {
        this.client = client;
        /** @type {Map<string, import("./BasePlugin")>} */
        this.plugins = new Map();
        this.events = new Set();
    }

    /**
     * Logs something on the console
     * @param {String} message 
     */
    log(message) {
        console.log(`[${this.constructor.name}] ${message}`)
    }

    init() {
        this.log(`Loading plugins...`)
        const plugins = fs.readdirSync("./plugins").filter(file => file.endsWith(".js"));
        plugins.forEach(file => {
            this.load(file)
        });
        this.log(`Successfully Loaded ${this.plugins.size} plugins`)
    }

    load(pluginName) {
        try {
            const plugin = require(`../plugins/${pluginName}`);
            delete require.cache[require.resolve(`../plugins/${pluginName}`)];
            const _plugin = new plugin(this.client);
            if (_plugin.conf.enabled)
                _plugin.loadCommands()
            this.add(_plugin)
        } catch (error) {
            console.error(error.stack)
            this.log("Unable to load " + pluginName + ": " + error)
            return { error }
        }
        return {}
    }

    add(plugin) {
        this.plugins.set(plugin.about.name, plugin);
        this.log(`${plugin.about.name} loaded`)

        const eventCallback = event => async (...args) => {
            for (let [_name, plugin] of new Map([...this.plugins.entries()].sort((a, b) => b[1].conf.priority - a[1].conf.priority))) {
                if (plugin.conf.enabled && (plugin.conf.event == event || plugin.conf.event.includes(event))) {
                    let execution;

                    if (Array.isArray(plugin.conf.event))
                        execution = await plugin.run(this.client, event, ...args);
                    else
                        execution = await plugin.run(this.client, ...args);

                    if (execution?.cancelEvent)
                        break;
                }
            }
        }

        if (typeof plugin.conf.event == "string") {
            if (!this.events.has(plugin.conf.event)) {
                const event = plugin.conf.event
                this.events.add(event);
                this.client.on(event, eventCallback(event))
            }
        } else if (Array.isArray(plugin.conf.event)) {
            plugin.conf.event.forEach(evt => {
                if (!this.events.has(evt)) {
                    const event = evt
                    this.events.add(event);
                    this.client.on(event, eventCallback(event))
                }
            })
        }
    }

    reload(pluginName) {
        return this.unload(pluginName) ? (this.load(pluginName)?.error ? false : true) : false
    }

    unload(pluginName) {
        let tru = (pluginName) => { this.log(`${pluginName} unloaded`); return true }
        return this.plugins.delete(pluginName) ? tru(pluginName) : false;
    }

    enable(pluginName) {
        if (!this.plugins.get(pluginName)) return false
        let tru = (pluginName) => { this.log(`${pluginName} enabled`); return true }
        return this.plugins.get(pluginName).conf.enabled = true ? tru(pluginName) : false;
    }

    disable(pluginName) {
        if (!this.plugins.get(pluginName)) return false
        let tru = (pluginName) => { this.log(`${pluginName} disabled`); return true }
        return !(this.plugins.get(pluginName).conf.enabled = false) ? tru(pluginName) : false;
    }

    isLoaded(pluginName) {
        return this.plugins.get(pluginName) ? this.plugins.get(pluginName).conf.enabled : false
    }

    info(pluginName) {
        if (!this.plugins.get(pluginName)) return { error: "Invalid plugin name" }
        return {
            description: this.plugins.get(pluginName).about.info,
            enabled: this.plugins.get(pluginName).conf.enabled,
            loaded: true,
            event: this.plugins.get(pluginName).conf.event
        }
    }

    get list() {
        return {
            loaded: [...this.plugins.values()].map(plugin => `${this.isLoaded(plugin.about.name) ? emojis.greenTick : emojis.redTick} **${plugin.about.name}**`).join("\n"),
            unloaded: fs.readdirSync("./plugins").filter(file => file.endsWith(".js")).map(fl => fl.split(".")[0]).filter(plg => ![...this.plugins.keys()].includes(plg)).map(plugin => `**${plugin}**`).join("\n")
        }
    }

    /**
     * @param {string} cmd 
     * @returns {[Command, BasePlugin] | [null, null]}
     */
    getCommand(cmd) {
        const match = [...this.plugins.values()].find(plugin => {
            return plugin?.commands?.has(cmd)
        });
        if (!match)
            return [null, null];
        return [match.commands.get(cmd), match];
    }

    /**
     * @type {Command[]}
     */
    get commands() {
        return [...this.plugins.values()].reduce((commands, plugin) => [...commands, ...plugin.commands.values()], []);
    }
}

module.exports = { PluginManager }