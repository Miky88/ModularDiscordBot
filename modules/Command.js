module.exports = class Command {
    /**
     * @param {boolean} slash Whether this is a slash command.
     */
    constructor(slash) {
        this.slash = slash;
    }
}