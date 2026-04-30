const chalk = require('chalk');

module.exports = class Logger {
    /**
     * Global toggle for `verbose()` calls. Set once at boot from
     * `config.verbose` in index.js. Defaults to `false` (verbose suppressed).
     */
    static verboseEnabled = false;

    /**
     * @param {String} name
     */
    constructor(name, saveToFile = true) {
        this.name = name;
        this._saveToFile = saveToFile;
    }

    /**
     * Saves the message to logs.txt
     * @param {String} message
     * @param {String} type error or simple log
     * @param {Date} date  
     */
    saveToFile(date, type = "log", ...message) {
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        const dir = process.cwd();
        const fs = require('fs');

        if (type === "error") {
            try {
                fs.appendFileSync(dir + "/err.txt", `${date.toLocaleDateString('it')} ${date.getHours()}:${date.getMinutes()} [${this.name}] ${final}\n`)
            } catch (err) {
                if (err) throw err;
            };
        }

        try {
            fs.appendFileSync(dir + "/out.txt", `${date.toLocaleDateString('it')} ${date.getHours()}:${date.getMinutes()} [${this.name}] ${final}\n`)
        } catch (err) {
            if (err) throw err;
        };
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
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
        if (this._saveToFile) this.saveToFile(new Date(), "error", final);
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
    }

    /**
     * Verbose log — gated by the global `Logger.verboseEnabled` flag (set
     * from `config.verbose` at boot in index.js). When disabled, this is a
     * complete no-op (no console, no file).
     * @param {String} message
     */
    verbose(...message) {
        if (!Logger.verboseEnabled) return;
        let final = "";

        for (const msg of message) {
            final += `${msg}`;
        }

        console.log(`[${chalk.cyan(this.name)}] ${chalk.cyan(final)}`);
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
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
        if (this._saveToFile) this.saveToFile(new Date(), '', final);
    }
}