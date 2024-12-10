const fs = require('fs');
const Module = require('./Module.js');
const Command = require('./Command.js');
const Logger = require('./Logger.js');
const SettingsManager = require('./SettingsManager.js');

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
            if (!this.isLoaded(file.split(".")[0])) {
                this.load(file)
            }
        });
        this.client.database.reconfigure(); 
        this.logger.success(`Successfully Loaded ${this.modules.size} modules`)
    }

    /**
     * @param {String} moduleName 
     */
    load(moduleName) {
        try {
            const module = require(`../modules/${moduleName}`);
            delete require.cache[require.resolve(`../modules/${moduleName}`)];
            const _module = new module(this.client);
            if (_module.options.dependencies.length > 0) {
                let dependencies = _module.options.dependencies;
                for (let dependence of dependencies) {
                    if (!this.isLoaded(dependence)) {
                        this.load(dependence);
                        this.logger.verbose(`Successfully loaded dependence ${dependence} of ${moduleName}`);
                    }
                }
            }
            if (_module.options.enabled)
                _module.loadCommands()
            if (_module.options.usesDB) {
                this.client.database.db[`module_${_module.options.name}`] = this.client.database.db.addCollection(`module_${_module.options.name}`);
                this.client.database.collections.push(`module_${_module.options.name}`);
            }
            if (_module.options.settings) {
                _module.settings = new SettingsManager(this.client, _module, _module.options.settings);
                this.client.database.collections.push(`settings_${_module.options.name}`);
            }

            this.add(_module)
        } catch (error) {
            this.logger.error("Unable to load " + moduleName + ": " + error)
            return { error }
        }
        return {}
    }

    /**
     * @param {Module} module 
     */
    add(module) {
        this.modules.set(module.options.name, module);
        this.logger.verbose(`${module.options.name} loaded`)

        const eventCallback = event => async (...args) => {
            for (let [_name, module] of new Map([...this.modules.entries()].sort((a, b) => b[1].options.priority - a[1].options.priority))) {
                if (module.options.enabled && module.options.events.includes(event)) {
                    let execution;

                    execution = await module.run(this.client, event, ...args);

                    if (execution?.cancelEvent)
                        break;
                }
            }
        }
        module.options.events.forEach(evt => {
            if (!this.events.has(evt)) {
                const event = evt
                this.events.add(event);
                this.client.on(event, eventCallback(event))
            }
        })
    }

    /**
     * @param {String} pluginName 
     */
    reload(pluginName) {
        return this.unload(pluginName) && this.load(pluginName)
    }

    /**
     * @param {String} pluginName 
     */
    unload(pluginName) {
        this.logger.log(`${pluginName} unloaded`);
        return this.modules.delete(pluginName);
    }

    /**
     * @param {String} pluginName 
     */
    enable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        this.logger.log(`${pluginName} enabled`);
        return this.modules.get(pluginName).options.enabled = true;
    }

    /**
     * @param {String} pluginName 
     */
    disable(pluginName) {
        if (!this.modules.get(pluginName)) return false
        this.logger.log(`${pluginName} disabled`);
        return !(this.modules.get(pluginName).options.enabled = false);
    }

    /**
     * @param {String} pluginName 
     */
    isLoaded(pluginName) {
        return !!this.modules.get(pluginName);
    }

    /**
     * @param {String} pluginName 
     */
    info(pluginName) {
        if (!this.modules.get(pluginName)) return { error: "Invalid module name" }
        return {
            description: this.modules.get(pluginName).options.info,
            enabled: this.modules.get(pluginName).options.enabled,
            loaded: this.isLoaded(pluginName),
            events: this.modules.get(pluginName).options.events
        }
    }

    get list() {
        return {
            loaded: [...this.modules.values()].map(module => `${this.isLoaded(module.options.name) ? ":white_check_mark:" : ":x:"} **${module.options.name}**`).join("\n"),
            unloaded: fs.readdirSync("./modules").filter(file => file.endsWith(".js")).map(fl => fl.split(".")[0]).filter(plg => ![...this.modules.keys()].includes(plg)).map(module => `**${module}**`).join("\n")
        }
    }

    /**
     * @param {String} cmd 
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
