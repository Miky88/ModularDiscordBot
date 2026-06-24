const chalk = require('chalk');

/**
 * Console logger. Emits colorized, prefixed lines to stdout only.
 *
 * Persistent logging is intentionally NOT this class's job — the structured,
 * date-rotated on-disk pipeline lives in `ErrorHandler` (logs/errors-*.jsonl
 * and .log). Routine stdout is expected to be captured by the process
 * supervisor (pm2 / systemd / docker), per the 12-factor approach.
 */
module.exports = class Logger {
    /**
     * Global toggle for `verbose()` calls. Set once at boot from
     * `config.verbose` in index.js. Defaults to `false` (verbose suppressed).
     */
    static verboseEnabled = false;

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
        console.log(`[${this.name}] ${message.join('')}`);
    }

    /**
     * Error something on the console
     * @param {String} message
     */
    error(...message) {
        const final = message.join('');
        console.log(`[${chalk.red(this.name)}] ${chalk.red(final)}`);
    }

    /**
     * Warn something on the console
     * @param {String} message
     */
    warn(...message) {
        const final = message.join('');
        console.log(`[${chalk.yellow(this.name)}] ${chalk.yellow(final)}`);
    }

    /**
     * Success something on the console
     * @param {String} message
     */
    success(...message) {
        const final = message.join('');
        console.log(`[${chalk.green(this.name)}] ${chalk.green(final)}`);
    }

    /**
     * Info something on the console
     * @param {String} message
     */
    info(...message) {
        const final = message.join('');
        console.log(`[${chalk.blueBright(this.name)}] ${chalk.blueBright(final)}`);
    }

    /**
     * Debug something on the console
     * @param {String} message
     */
    debug(...message) {
        const final = message.join('');
        console.log(`[${chalk.magenta(this.name)}] ${chalk.magenta(final)}`);
    }

    /**
     * Verbose log — gated by the global `Logger.verboseEnabled` flag (set
     * from `config.verbose` at boot in index.js). When disabled, this is a
     * complete no-op.
     * @param {String} message
     */
    verbose(...message) {
        if (!Logger.verboseEnabled) return;
        const final = message.join('');
        console.log(`[${chalk.cyan(this.name)}] ${chalk.cyan(final)}`);
    }

    /**
     * Custom something on the console
     * @param {String} message
     * @param {String} color
     */
    custom(color, ...message) {
        const final = message.join('');
        console.log(`[${chalk[color](this.name)}] ${chalk[color](final)}`);
    }
}
