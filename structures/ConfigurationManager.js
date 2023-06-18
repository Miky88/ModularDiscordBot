const { parse, stringify } = require('yaml')
const Plugin = require('./Plugin.js')
const fs = require('fs')

module.exports = class ConfigurationManager {
    /**
     * Creates a configuration manager for a module
     * @param {Plugin} module The module to create the configuration manager for
     * @param {Object} defaultConfig The default configuration for the module
     */
    constructor(module, defaultConfig) {
        this.defaultConfig = defaultConfig
        this.module = module;

        // Create config file if it doesn't exist in /modules/<module>/config.yml
        if (!fs.existsSync(`../modules/${this.module.constructor.name}/config.yml`)) {
            fs.writeFileSync(`../modules/${this.module.constructor.name}/config.yml`, stringify(this.defaultConfig))
        }

        this.file = parse(fs.readFileSync(`../modules/${this.module.constructor.name}/config.yml`, 'utf8'))

        // Check if config file has all the required fields
        for (const key in this.defaultConfig) {
            if (!this.file[key]) {
                this.file[key] = this.defaultConfig[key]
            }
        }
    }

    /**
     * Gets a value from the configuration file
     * @param {String} key 
     * @returns {*} The value from the configuration file 
     */
    get(key) {
        return this.file[key]
    }

    /**
     * Sets a value in the configuration file
     * @param {String} key
     * @param {*} value
     */
    set(key, value) {
        this.file[key] = value
        fs.writeFileSync(`../modules/${this.module.constructor.name}/config.yml`, stringify(this.file))
    }

    /**
     * Reloads the configuration file
     * @returns {Object} The new configuration file
     */
    reload() {
        this.file = parse(fs.readFileSync(`../modules/${this.module.constructor.name}/config.yml`, 'utf8'))
        return this.file
    }

    /**
     * Resets the configuration file to the default configuration
     * @returns {Object} The new configuration file
     */
    reset() {
        this.file = this.defaultConfig
        fs.writeFileSync(`../modules/${this.module.constructor.name}/config.yml`, stringify(this.file))
    }
}