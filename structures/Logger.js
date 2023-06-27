const chalk = require('chalk');

module.exports = class Logger {
    /**
     * @param {String} name 
     */
    constructor(name) {
        this.name = name;
    }

    /**
     * Logs something on the console
     * @param {String} message
     */
    log(message) {
        console.log(`[${this.name}] ${message}`)
    }

    /**
     * Error something on the console
     * @param {String} message
     */
    error(message) {
        console.error(`[${chalk.red(this.name)}] ${chalk.red(message)}`)
    }

    /**
     * Warn something on the console
     * @param {String} message
     */
    warn(message) {
        console.warn(`[${chalk.yellow(this.name)}] ${chalk.yellow(message)}`)
    }

    /**
     * Success something on the console
     * @param {String} message
     */
    success(message) {
        console.log(`[${chalk.green(this.name)}] ${chalk.green(message)}`)
    }

    /**
     * Info something on the console
     * @param {String} message
     */
    info(message) {
        console.log(`[${chalk.blueBright(this.name)}] ${chalk.blueBright(message)}`)
    }

    /**
     * Debug something on the console
     * @param {String} message
     */
    debug(message) {
        console.log(`[${chalk.magenta(this.name)}] ${chalk.magenta(message)}`)
    }

    /**
     * Verbose something on the console
     * @param {String} message
     */
    verbose(message) {
        console.log(`[${chalk.cyan(this.name)}] ${chalk.cyan(message)}`)
    }

    /**
     * Custom something on the console
     * @param {String} message
     * @param {String} color
     */
    custom(message, color) {
        console.log(`[${chalk[color](this.name)}] ${chalk[color](message)}`)
    }
}