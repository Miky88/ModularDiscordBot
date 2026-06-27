const Module = require("@structures/Module.js");
const ImportantFile = require("./lib/importantFile.js");

module.exports = class Example extends Module {
    constructor(client) {
        super(client, {
            name: "Example",
            info: "Very important module",
            events: ["clientReady"],
            config: {
                exampleString: 'Hello, world!',
                exampleNumber: 67,
                exampleArray: [1, 2, 3],
                exampleBoolean: true
            },

            settings: {
                welcomeMessage: {
                    type: 'string',
                    default: 'Welcome to the server, {user}!',
                    description: 'Message sent when a member joins. Supports {user} and {server}.'
                },
                prefix: {
                    type: 'string',
                    default: '!',
                    description: 'Legacy text-command prefix (max 3 characters).',
                    validate: v => v.length <= 3 || 'must be at most 3 characters'
                },
                maxWarnings: {
                    type: 'integer',
                    default: 3,
                    description: 'Warnings before an automatic action (0–10).',
                    validate: v => (v >= 0 && v <= 10) || 'must be between 0 and 10'
                },
                dailyReward: {
                    type: 'integer',
                    default: 100,
                    description: 'Coins handed out by the daily command.'
                },
                spawnRate: {
                    type: 'number',
                    default: 0.5,
                    description: 'Random-event spawn chance, from 0 to 1.',
                    validate: v => (v >= 0 && v <= 1) || 'must be between 0 and 1'
                },
                adminUserId: {
                    type: 'snowflake',
                    default: null,
                    description: 'A raw Discord user ID, entered as text (snowflake).'
                },

                // --- toggle & choice ---
                featureEnabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Master switch for the example feature.'
                },
                greetingStyle: {
                    type: 'enum:friendly|formal|silly',
                    default: 'friendly',
                    description: 'Tone used for greeting messages.'
                },

                // --- native Discord pickers (single) ---
                logChannel: {
                    type: 'channel',
                    default: null,
                    description: 'Where the module writes its logs.'
                },
                modRole: {
                    type: 'role',
                    default: null,
                    description: 'Role treated as a moderator for the example feature.'
                },
                botOwnerUser: {
                    type: 'user',
                    default: null,
                    description: 'A specific user with extra privileges here.'
                },

                // --- arrays (every inner type) ---
                blockedWords: {
                    type: 'array<string>',
                    default: [],
                    description: 'Words filtered out of messages.'
                },
                luckyNumbers: {
                    type: 'array<number>',
                    default: [7, 13],
                    description: 'Numbers that trigger a bonus.'
                },
                ignoredChannels: {
                    type: 'array<channel>',
                    default: [],
                    description: 'Channels the module ignores entirely.'
                },
                staffRoles: {
                    type: 'array<role>',
                    default: [],
                    description: 'Roles granted staff access to the example feature.'
                },
                vipUsers: {
                    type: 'array<user>',
                    default: [],
                    description: 'Users with VIP perks.'
                }
            }
        })
    }

    /**
     * @param {import('../../index.js')} client
     */
    async clientReady(client) {
        this.logger.info('This module is doing very important things.');
        this.logger.info(`Example string: ${this.config.get('exampleString')}`);
        this.logger.info(`Example number: ${this.config.get('exampleNumber')}`);
        this.logger.info(`Example array: ${this.config.get('exampleArray').join(', ')}`);
        this.logger.info(`Example boolean: ${this.config.get('exampleBoolean')}`);
        const importantFile = new ImportantFile();
        this.logger.info(`The important function returned: ${importantFile.importantFunction()}`);
    }
}
