const { parse, stringify } = require('yaml')
const Module = require('./Module.js')
const fs = require('fs')
const { Client } = require('discord.js')

module.exports = class ConfigurationManager {
    /**
     * Creates a configuration manager for a module
     * @param {Module} module The module to create the configuration manager for
     * @param {Object} defaultConfig The default configuration for the module
     * @param {String} customName The name of the configuration file without the extension (default: config)
     */
    constructor(module, defaultConfig, name = 'config') {
        this.defaultConfig = defaultConfig
        this.module = module;
        this.name = name
        this.path = (this.module == 'Client') ? `config.yml` : `./modules/${this.module.constructor.name}/${this.name}.yml`

        // Create config file if it doesn't exist in /modules/<module>/config.yml
        if (!fs.existsSync(this.path)) {
            if(module.logger)
                module.logger.info(`Creating ${this.name}.yml file for ${this.module.constructor.name ? this.module.constructor.name : 'Client'}`)
            fs.writeFileSync(this.path, stringify(this.defaultConfig))
        }

        this.file = parse(fs.readFileSync(this.path, 'utf8'))

        // Check if config file has all the required fields
        for (const key in this.defaultConfig) {
            if (!this.file[key]) {
                this.file[key] = this.defaultConfig[key]
            }
        }

        // Re-write config file if it doesn't have all the required fields
        if (Object.keys(this.file).length !== Object.keys(this.defaultConfig).length) {
            fs.writeFileSync(this.path, stringify(this.file))
        }
    }

    /**
     * Gets a value from the configuration file
     * @param {String} key Key can be a path to a nested object
     * @returns {*} The value from the configuration file 
     */
    get(key) {
        return key.split('.').reduce((o, i) => o[i], this.file)
    }

    /**
     * Sets a value in the configuration file
     * @param {String} key Key can be a path to a nested object
     * @param {*} value
     */
    set(key, value) {
        key = key.split('.')
        let lastKey = key.pop()
        let obj = key.reduce((o, i) => o[i], this.file)
        obj[lastKey] = value
        fs.writeFileSync(this.path, stringify(this.file))
    }

    /**
     * Reloads the configuration file
     * @returns {Object} The new configuration file
     */
    reload() {
        this.file = parse(fs.readFileSync(this.path, 'utf8'))
        return this.file
    }

    /**
     * Resets the configuration file to the default configuration
     * @returns {Object} The new configuration file
     */
    reset() {
        this.file = this.defaultConfig
        fs.writeFileSync(this.path, stringify(this.file))
    }
}