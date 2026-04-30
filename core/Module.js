const { Collection, BaseInteraction } = require('discord.js');
const fs = require('fs');
const BotClient = require('..');
const ModulePriorities = require('./ModulePriorities');
const ConfigurationManager = require('./ConfigurationManager');
const SettingsManager = require('./SettingsManager');
const Logger = require('./Logger');

module.exports = class Module {
    /**
     * @param {BotClient} client
     * @param {object} options
     * @param {string} [options.name]
     * @param {string} [options.info]
     * @param {boolean} [options.enabled]
     * @param {string[]} [options.events]
     * @param {boolean | string[]} [options.databases] Either `true` for a single
     *   `default` collection in `data/<Module>.db`, or an array of collection
     *   names (e.g. `['guilds', 'logs']`) to declare upfront.
     * @param {number} [options.priority]
     * @param {string[]} [options.dependencies]
     * @param {object} [options.config]
     * @param {object} [options.settings]
     */
    constructor(client, {
        name = this.constructor.name,
        info = "No description provided.",
        enabled = false,
        events = [],
        databases = false,
        priority = ModulePriorities.NORMAL,
        dependencies = [],
        config = null,
        settings = null
    }) {
        this.client = client;

        const declaredCollections = Array.isArray(databases)
            ? [...databases]
            : (databases ? ['default'] : []);

        this.options = {
            name, info, enabled, events, priority,
            databases,
            collections: declaredCollections,
            dependencies, settings
        };

        this.commands = new Collection();
        this.logger = new Logger(this.options.name);

        if (config)
            this.config = new ConfigurationManager(this, config);
        if (settings)
            this.settings = new SettingsManager(client, this, settings);
    }

    t(_key, interactionOrLang, vars) {
        let key = `modules.${this.options.name}.${_key}`;
        // Lang:
        // - Check if forced on user data
        // - Check if forced on guild settings
        // - Check discord interaction.language
        // - Else, default

        if (interactionOrLang instanceof BaseInteraction) {
            const interaction = interactionOrLang;
            const i18n = this.client.i18n;

            const utility = this.client.moduleManager.modules.get("Utility")?.settings;
            const guildLang = interaction.guild
                ? utility?.get(interaction.guild.id)?.settings?.defaultServerLanguage
                : null;
            const userData = this.client.database.forceUser(interaction.user.id);

            // Resolution order: user-forced → guild default → Discord interaction locale → bot default.
            let lang = i18n.defaultLang;
            const candidates = [userData?.language, guildLang, interaction.locale];
            for (const candidate of candidates) {
                const resolved = candidate && i18n.resolveLanguage(candidate);
                if (resolved && i18n.languages[resolved]) { lang = resolved; break; }
            }

            return i18n.t(key, lang, vars);
        } else {
            const lang = interactionOrLang || this.client.i18n.defaultLang;
            return this.client.i18n.t(key, lang, vars);
        }

    }

    getLocalizationObject(_key) {
        let key = `modules.${this.options.name}.${_key}`;
        return this.client.i18n.getLocalizationObject(key);
    }

    async loadCommands() {
        const commands = fs.existsSync(`./modules/${this.options.name}/commands`) ? fs.readdirSync(`./modules/${this.options.name}/commands`).filter(file => file.endsWith(".js")) : [];

        commands.forEach(file => {
            try {
                /**
                 * @type {import('./Command')}
                 */
                const command = require(`../modules/${this.options.name}/commands/${file}`);
                delete require.cache[require.resolve(`../modules/${this.options.name}/commands/${file}`)];
                const _command = new command(this.client, this);
                
                this.commands.set(file.split(".")[0], _command);
                this.logger.verbose(`Loaded command ${file.split(".")[0]} from ${this.options.name}`);
            } catch (e) {
                this.logger.error(`Failed to load command ${file} from ${this.options.name}: ${e.stack || e}`);
            }
        }); 
    }

    run(client, event, ...args) {
        // Register automatic event method caller
        const method = this[event];
        if (!method)
            return this.logger.error(`[${this.options.name}] There was no configured method for the ${event} event.`);
        return method.call(this, client, ...args);
    }

    /**
     * The module's database handle. `null` if the module didn't opt in via
     * the `databases` option. Use `this.db.collection(name)` to access a
     * specific collection, or the convenience proxy (e.g. `this.db.guilds`)
     * for collections declared at construction time.
     * @type {import('./DatabaseHandle') | null}
     */
    get db() {
        if (this.options.collections.length === 0) return null;
        return this.client.database.get(this.options.name) || null;
    }

    /**
     * Insert-or-update a row into one of the module's collections.
     * @param {string} collectionName
     * @param {object} data
     */
    saveData(collectionName, data) {
        if (!this.db)
            throw new Error("You must declare `databases` in module options to use this method.");
        if (!data)
            throw new Error("You must pass a valid argument to data.");

        const collection = this.db.collection(collectionName);
        if (data.$loki) collection.update(data);
        else collection.insert(data);
    }
}
