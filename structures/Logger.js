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
    log(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${this.name}] ${final}`);
    }

    /**
     * Error something on the console
     * @param {String} message
     */
    error(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.red(this.name)}] ${chalk.red(final)}`);
    }

    /**
     * Warn something on the console
     * @param {String} message
     */
    warn(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.yellow(this.name)}] ${chalk.yellow(final)}`);
    }

    /**
     * Success something on the console
     * @param {String} message
     */
    success(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.green(this.name)}] ${chalk.green(final)}`);
    }

    /**
     * Info something on the console
     * @param {String} message
     */
    info(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.blueBright(this.name)}] ${chalk.blueBright(final)}`);
    }

    /**
     * Debug something on the console
     * @param {String} message
     */
    debug(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.magenta(this.name)}] ${chalk.magenta(final)}`);
    }

    /**
     * Verbose something on the console
     * @param {String} message
     */
    verbose(...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.cyan(this.name)}] ${chalk.cyan(final)}`);
    }

    /**
     * Custom something on the console
     * @param {String} message
     * @param {String} color
     */
    custom(color, ...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk[color](this.name)}] ${chalk[color](final)}`)
    }
}