const { parse, stringify } = require('yaml')
const Module = require('./Module.js')
const fs = require('fs')

module.exports = class ConfigurationManager {
    /**
     * Creates a configuration manager for a module
     * @param {Module} module The module to create the configuration manager for
     * @param {Object} defaultConfig The default configuration for the module
     * @param {String} customName The name of the configuration file without the extension (default: config)
     */
    constructor(module, defaultConfig, name = 'config.yml') {
        this.defaultConfig = defaultConfig
        this.module = module;
        this.name = name

        // Create config file if it doesn't exist in /modules/<module>/config.yml
        if (!fs.existsSync(`./modules/${this.module.constructor.name}/${this.name}.yml`)) {
            module.logger.info(`Creating ${this.name}.yml file for ${this.module.constructor.name}`)
            fs.writeFileSync(`./modules/${this.module.constructor.name}/${this.name}.yml`, stringify(this.defaultConfig))
        }

        this.file = parse(fs.readFileSync(`./modules/${this.module.constructor.name}/${this.name}.yml`, 'utf8'))

        // Check if config file has all the required fields
        for (const key in this.defaultConfig) {
            if (!this.file[key]) {
                this.file[key] = this.defaultConfig[key]
            }
        }

        // Re-write config file if it doesn't have all the required fields
        if (Object.keys(this.file).length !== Object.keys(this.defaultConfig).length) {
            fs.writeFileSync(`./modules/${this.module.constructor.name}/${this.name}.yml`, stringify(this.file))
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
        fs.writeFileSync(`../modules/${this.module.constructor.name}/${this.name}.yml`, stringify(this.file))
    }

    /**
     * Reloads the configuration file
     * @returns {Object} The new configuration file
     */
    reload() {
        this.file = parse(fs.readFileSync(`../modules/${this.module.constructor.name}/${this.name}.yml`, 'utf8'))
        return this.file
    }

    /**
     * Resets the configuration file to the default configuration
     * @returns {Object} The new configuration file
     */
    reset() {
        this.file = this.defaultConfig
        fs.writeFileSync(`../modules/${this.module.constructor.name}/${this.name}.yml`, stringify(this.file))
    }
}