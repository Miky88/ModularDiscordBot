// Imports
require('dotenv').config();
require("module-alias/register");

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const ModuleManager = require('./core/ModuleManager.js');
const Database = require('./core/Database.js');
const ConfigurationManager = require('./core/ConfigurationManager.js');
const Utils = require('./core/Utils.js');
const LocalizationManager = require('./core/LocalizationManager.js');
const ErrorHandler = require('./core/ErrorHandler.js');
const PermissionsManager = require('./core/Permissions.js');
const Logger = require('./core/Logger.js');
BigInt.prototype.toJSON = function () { return this.toString() } // MDN https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#use_within_json

// Discord
class BotClient extends Client {
    constructor(options) {
        const config = new ConfigurationManager('Client', {
            activity: `/help`,
            owners: ["311929179186790400", "422418878459674624"],
            systemServer: ["1313550337474429001"],
            intents: Object.keys(GatewayIntentBits).filter(i => isNaN(i)),
            partials: ['Reaction', 'Message'],
            verbose: false,
            errorReporting: {
                channelId: null,
                notifyOwners: false,
                dedupWindowMs: 60000,
                exitOnUncaught: true
            },
            i18n: {
                defaultLang: 'en-GB',
                referenceLanguage: 'en-GB',
                autoSync: true,
                hotReload: false
            }
        });
        Logger.verboseEnabled = !!config.get('verbose');
        super({
            intents: config.get('intents').map(i => GatewayIntentBits[i]),
            partials: config.get('partials').map(i => Partials[i])
        });

        this.commands = new Collection();
        this.settings = new Collection();
        this.utils = new Utils();
        this.moduleManager = new ModuleManager(this);
        this.config = config;
        this.i18n = new LocalizationManager(config.get('i18n'));

        this.errorHandler = new ErrorHandler(this, config.get('errorReporting'));
        this.database = new Database(this);
        this.permissions = new PermissionsManager(this);
    }
};


(async () => {
    const client = new BotClient();
    await client.moduleManager.init();
    await client.login(process.env.TOKEN);
})();

module.exports = BotClient;
