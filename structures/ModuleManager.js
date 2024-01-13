const fs = require('fs');
const Module = require('./Module.js');
const Command = require('./Command.js');
const Logger = require('./Logger.js');

module.exports = class ModuleManager {
    /**
     * @param {import('..')} client 
     */
    constructor(client) {
        this.client = client;
        /** @type {Map<string, import("./Module.js")>} */
        this.modules = new Map();
        this.events = new Set();
        this.logger = new Logger(this.constructor.name);
    }

    init() {
        this.logger.info(`Loading modules...`)
        const modules = fs.readdirSync("./modules").filter(file => file.endsWith(".js"));
        modules.forEach(file => {
            this.load(file)
        });
        this.logger.success(`Successfully Loaded ${this.modules.size} modules`)
    }

    load(moduleName) {
        try {
            const module = require(`../modules/${moduleName}`);
            delete require.cache[require.resolve(`../modules/${moduleName}`)];
            const _module = new module(this.client);
            if (_module.options.enabled)
                _module.loadCommands()
            this.add(_module)
        } catch (error) {
            this.logger.error("Unable to load " + moduleName + ": " + error)
            return { error }
        }
        return {}
    }

    add(module) {
        this.modules.set(module.options.name, module);
        this.logger.verbose(`${module.options.name} loaded`)

        const eventCallback = event => async (...args) => {
            for (let [_name, module] of new Map([...this.modules.entries()].sort((a, b) => b[1].options.priority - a[1].options.priority))) {
                if (module.options.enabled && (module.options.event == event || module.options.event.includes(event))) {
                    let execution;

                    if (Array.isArray(module.options.event))
                        execution = await module.run(this.client, event, ...args);
                    else
                        execution = await module.run(this.client, ...args);

                    if (execution?.cancelEvent)
                        break;
                }
            }
        }

        if (typeof module.options.event == "string") {
            if (!this.events.has(module.options.event)) {
                const event = module.options.event
                this.events.add(event);
                this.client.on(event, eventCallback(event))
            }
        } else if (Array.isArray(module.options.event)) {
            module.options.event.forEach(evt => {
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
        let tru = (pluginName) => { this.logger.log(`${pluginName} unloaded`); return true }
        return this.modules.delete(pluginName) ? tru(pluginName) : false;
    }

    enable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        let tru = (pluginName) => { this.logger.log(`${pluginName} enabled`); return true }
        return this.modules.get(pluginName).options.enabled = true ? tru(pluginName) : false;
    }

    disable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        let tru = (pluginName) => { this.logger.log(`${pluginName} disabled`); return true }
        return !(this.modules.get(pluginName).options.enabled = false) ? tru(pluginName) : false;
    }

    isLoaded(pluginName) {
        return this.modules.get(pluginName) ? this.modules.get(pluginName).options.enabled : false
    }

    info(pluginName) {
        if (!this.modules.get(pluginName)) return { error: "Invalid module name" }
        return {
            description: this.modules.get(pluginName).options.info,
            enabled: this.modules.get(pluginName).options.enabled,
            loaded: true,
            event: this.modules.get(pluginName).options.event
        }
    }

    get list() {
        return {
            loaded: [...this.modules.values()].map(module => `${this.isLoaded(module.options.name) ? ":white_check_mark:" : ":x:"} **${module.options.name}**`).join("\n"),
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