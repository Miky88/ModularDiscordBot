module.exports = class Command {
    /**
     * @param {boolean} interaction Whether this is a interaction command.
     */
    constructor(interaction) {
        this.interaction = interaction;
    }
}