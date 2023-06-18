const { emojis } = require('../config.js');
const fs = require('fs');
const Module = require('./Module.js');
const Command = require('./Command.js');

module.exports = class ModuleManager {
    constructor(client) {
        this.client = client;
        /** @type {Map<string, import("./Module.js")>} */
        this.modules = new Map();
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
        this.log(`Loading modules...`)
        const modules = fs.readdirSync("./modules").filter(file => file.endsWith(".js"));
        modules.forEach(file => {
            this.load(file)
        });
        this.log(`Successfully Loaded ${this.modules.size} modules`)
    }

    load(moduleName) {
        try {
            const module = require(`../modules/${moduleName}`);
            delete require.cache[require.resolve(`../modules/${moduleName}`)];
            const _module = new module(this.client);
            if (_module.conf.enabled)
                _module.loadCommands()
            this.add(_module)
        } catch (error) {
            console.error(error.stack)
            this.log("Unable to load " + moduleName + ": " + error)
            return { error }
        }
        return {}
    }

    add(module) {
        this.modules.set(module.about.name, module);
        this.log(`${module.about.name} loaded`)

        const eventCallback = event => async (...args) => {
            for (let [_name, module] of new Map([...this.modules.entries()].sort((a, b) => b[1].conf.priority - a[1].conf.priority))) {
                if (module.conf.enabled && (module.conf.event == event || module.conf.event.includes(event))) {
                    let execution;

                    if (Array.isArray(module.conf.event))
                        execution = await module.run(this.client, event, ...args);
                    else
                        execution = await module.run(this.client, ...args);

                    if (execution?.cancelEvent)
                        break;
                }
            }
        }

        if (typeof module.conf.event == "string") {
            if (!this.events.has(module.conf.event)) {
                const event = module.conf.event
                this.events.add(event);
                this.client.on(event, eventCallback(event))
            }
        } else if (Array.isArray(module.conf.event)) {
            module.conf.event.forEach(evt => {
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
        return this.modules.delete(pluginName) ? tru(pluginName) : false;
    }

    enable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        let tru = (pluginName) => { this.log(`${pluginName} enabled`); return true }
        return this.modules.get(pluginName).conf.enabled = true ? tru(pluginName) : false;
    }

    disable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        let tru = (pluginName) => { this.log(`${pluginName} disabled`); return true }
        return !(this.modules.get(pluginName).conf.enabled = false) ? tru(pluginName) : false;
    }

    isLoaded(pluginName) {
        return this.modules.get(pluginName) ? this.modules.get(pluginName).conf.enabled : false
    }

    info(pluginName) {
        if (!this.modules.get(pluginName)) return { error: "Invalid module name" }
        return {
            description: this.modules.get(pluginName).about.info,
            enabled: this.modules.get(pluginName).conf.enabled,
            loaded: true,
            event: this.modules.get(pluginName).conf.event
        }
    }

    get list() {
        return {
            loaded: [...this.modules.values()].map(module => `${this.isLoaded(module.about.name) ? emojis.greenTick : emojis.redTick} **${module.about.name}**`).join("\n"),
            unloaded: fs.readdirSync("./modules").filter(file => file.endsWith(".js")).map(fl => fl.split(".")[0]).filter(plg => ![...this.modules.keys()].includes(plg)).map(module => `**${module}**`).join("\n")
        }
    }

    /**
     * @param {string} cmd 
     * @returns {[Command, Module] | [null, null]}
     */
    getCommand(cmd) {
        const match = [...this.modules.values()].find(module => {
            return module?.commands?.has(cmd)
        });
        if (!match)
            return [null, null];
        return [match.commands.get(cmd), match];
    }

    /**
     * @type {Command[]}
     */
    get commands() {
        return [...this.modules.values()].reduce((commands, module) => [...commands, ...module.commands.values()], []);
    }
}