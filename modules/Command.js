module.exports = class Command {
    /**
     * @param {boolean} integration Whether this is a slash command.
     */
    constructor(integration) {
        this.integration = integration;
    }
}