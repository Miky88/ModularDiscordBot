const { stripIndents } = require("common-tags");
const BasePlugin = require("../modules/BasePlugin.js");
const { parseFlags, parseArgs } = require("../modules/ArgParser.js");
const { readdir } = require("fs")
const { resolve } = require("path");
const PluginPriorities = require("../modules/PluginPriorities.js");
const BotClient = require("../index.js");
const { Message } = require("discord.js");

class CommandHandler extends BasePlugin {
    constructor(client) {
        super(client, {
            name: "CommandHandler",
            info: "Loads commands into the bot.",
            enabled: true,
            event: "messageCreate",
            system: true,
            priority: PluginPriorities.HIGHEST,
        })
        /** @type {Map<string, number>} */
        this.cooldownCache = new Map();
        this.types = new Map();

        readdir(resolve(__dirname, "..", 'types'), (err, files) => {
            if (err) console.error(err)
            files.forEach(async file => {
                const type = require(`../types/${file}`)
                this.types.set(type.name, type)
                console.log(`[Plugin Manager] Loaded type ${type.name} from ${this.about.name}`);
            })
        })
    }

    /**
     * @param {BotClient} client
     * @param {Message} message
     */
    async run(client, message) {

        // Initialize custom datas
        message.data = {}
        message.data.isCommand = false;
        message.author.data = await client.database.forceUser(message.author.id);

        // Ignore bots and non-commands
        if (message.author.bot) return;
        if (!message.content.startsWith(client.config.prefix)) return;

        // Define command arguments
        let args = message.content.slice(client.config.prefix.length).trim().split(/ +/g);

        //Define command
        const command = args.shift().toLowerCase();

        // Command check
        const [cmd, plugin] = client.PluginManager.getCommand(command);
        if (!cmd) return;

        message.data.isCommand = true;

        // Define flags
        let [newArgString, flags] = parseFlags(args.join(" "))
        message.data.flags = flags

        try {
            args = await parseArgs(this.types, cmd, message, newArgString.trim().split(/ +/g))
        } catch (e) {
            if (e instanceof Error)
                throw e;

            let error;

            switch (e.id) {
                case "ARG_EMPTY": error = `L'argomento \`${e.name}\` è vuoto.`; break;
                case "ARG_NULL": error = `L'argomento richiesto \`${e.name}\` è vuoto.`; break;
                case "ARG_ONEOF_NOT_IN_LIST": error = `L'argomento \`${e.name}\` deve essere uno dei seguenti valori: [${e.oneOf.map(e => `\`${e}\``).join(", ")}].`; break;
                case "ARG_OOB_FLOAT_MAX":
                case "ARG_OOB_INT_MAX": error = `L'argomento \`${e.name}\` deve essere al massimo ${e.max}.`; break;
                case "ARG_OOB_FLOAT_MIN":
                case "ARG_OOB_INT_MIN": error = `L'argomento \`${e.name}\` deve essere almeno ${e.min}.`; break;
                case "ARG_OOB_FLOAT":
                case "ARG_OOB_INT": error = `L'argomento \`${e.name}\` deve essere un valore compreso tra ${e.min} e ${e.max}.`; break;
                case "ARG_OOB_LEN_MAX": error = `La lunghezza dell'argomento \`${e.name}\` deve essere al massimo ${e.max}.`; break;
                case "ARG_OOB_LEN_MIN": error = `La lunghezza dell'argomento \`${e.name}\` deve essere almeno ${e.min}.`; break;
                case "ARG_OOB_LEN": error = `La lunghezza dell'argomento \`${e.name}\` deve essere un valore compreso tra ${e.min} e ${e.max}.`; break;
                case "GENERIC_INVALID":
                default:
                    error = `L'argomento \`${e.name}\` non è valido.`; break;
            }

            return message.channel.send(stripIndents`
        :no_entry: | ${error}
        :information_source: | Il formato corretto è \`${client.config.prefix}${command} ${cmd.help.usage}\`
        `);
        }

        // System Permission check
        if (message.author.data.powerlevel < cmd.config.minLevel) {
            let reqLevel = client.config.powerlevels.find(pl => pl.level == cmd.config.minLevel)
            let usrLevel = client.config.powerlevels.find(pl => pl.level == message.author.data.powerlevel)
            return message.channel.send(`:no_entry: You don't have permission to perform this command. Minimum system permission required is **${reqLevel.icon} ${reqLevel.level} - ${reqLevel.name}** and your system permission is **${usrLevel.icon} ${usrLevel.level} - ${usrLevel.name}**`)
        }
        // Server and Channel Permission check
        if (!message.channel.permissionsFor(message.author.id).has(cmd.config.reqPerms))
            return message.channel.send(":no_entry: You don't have the required permissions to perform this command: " + cmd.config.reqPerms.map(p => "`" + p.replace("_", " ").toProperCase() + "`").join(", "))
        // Bot Server and Channel Permission check
        if (!message.channel.permissionsFor(message.author.id).has(cmd.config.botPerms))
            return message.channel.send(":no_entry: The bot doesn't have the required permissions to perform this command: " + cmd.config.botPerms.map(p => "`" + p.replace("_", " ").toProperCase() + "`").join(", "))


        // Cooldown check
        const limitFlag = `${message.author.id}-${cmd.help.name}`;
        if (this.cooldownCache.has(limitFlag)) return message.channel.send(":timer: You are on cooldown. Please try again in " + ((this.cooldownCache.get(limitFlag) - Date.now()) / 1000).toFixed(1) + "s");

        //Run command
        try {
            this.cooldownCache.set(limitFlag, Date.now() + cmd.config.cooldown * 1000);
            setTimeout(() => {
                this.cooldownCache.delete(limitFlag);
            }, cmd.config.cooldown * 1000);
            await cmd.run(client, message, args, plugin);
        } catch (e) {
            message.channel.send(":no_entry: Si è verificato un errore durante l'esecuzione del comando: \n```js\n" + (e?.stacktrace ?? e) + "\n```")
            console.error(e)
        }
        
        return { cancelEvent: true};
    }
}

module.exports = CommandHandler;