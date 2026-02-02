const Module = require("../../lib/Module.js");
const ImportantFile = require("./lib/importantFile.js");

module.exports = class Example extends Module {
    constructor(client) {
        super(client, {
            name: "Example",
            info: "Very important module",
            enabled: true,
            events: ["ready"],
            config: {
                exampleString: 'Hello, world!',
                exampleNumber: 67,
                exampleArray: [1, 2, 3],
                exampleBoolean: true
            }
        })
    }

    /**
     * @param {import('../../index.js')} client
     */
    async ready(client) {
        this.logger.info('This module is doing very important things.');
        this.logger.info(`Example string: ${this.config.get('exampleString')}`);
        this.logger.info(`Example number: ${this.config.get('exampleNumber')}`);
        this.logger.info(`Example array: ${this.config.get('exampleArray').join(', ')}`);
        this.logger.info(`Example boolean: ${this.config.get('exampleBoolean')}`);
        const importantFile = new ImportantFile();
        this.logger.info(`The important function returned: ${importantFile.importantFunction()}`);
    }
}
