/**
 * @typedef Command
 * @property {CommandArgument[]} args
 */

/**
 * @typedef {(val: string, msg: import("discord.js").Message, arg: CommandArgument) => unknown} ArgFunction
 */

/**
 * @typedef {Object} ArgType
 *
 * @property {string} name
 * @property {ArgFunction} isEmpty
 * @property {ArgFunction} validate
 * @property {ArgFunction} parse
 */

/**
 * @typedef CommandArgument

 * @property {string} name
 * @property {ArgFunction} [isEmpty]
 * @property {ArgFunction} [validate]
 * @property {ArgFunction} [parse]
 * @property {string} [label]
 * @property {"channel" | "int" | "member" | "message" | "role" | "string" | "user"} type
 * @property {Array<string | number | object>} [oneOf]
 * @property {number} [min]
 * @property {number} [max]
 * @property {object | ((message: import("discord.js").Message) => object)} [default]
 * @property {boolean} [replies]
 */

/**
 * @param {import("discord.js").Client} client
 * @param {Command} command
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 *
 * @return {Promise<{ [x: string]: any }>} A number indicating an error, or the arg object.
 * @throws {{ error: true, id: string }}
 */
 async function parseArgs(types, command, message, args) {
    if (!command.config.args || !command.config.args.length) { return {} }

    const argsObject = {}
    for (let i = 0; i < command.config.args.length; i++) {
        const obj = command.config.args[i]
        let arg = args[i]
        if (i == command.config.args.length - 1) {
            arg = args.slice(i).join(' ').trim()
        }

        if ((arg == null || arg == undefined) && (obj.default == null || obj.default == undefined)) {
            throw {
                error: true,
                id: "ARG_NULL",
                ...obj
            }
        }

        let type;

        if (obj.type && !(obj.isEmpty && obj.validate && obj.parse)) {
            if (!types.has(obj.type)) {
                throw new TypeError(`Type "${obj.type}" isn't a registered type`)
            }

            type = types.get(obj.type)
        } else if (!obj.type && (obj.isEmpty && obj.validate && obj.parse)) {
            type = {
                isEmpty: obj.isEmpty,
                validate: obj.validate,
                parse: obj.parse
            }
        } else if (obj.type && (obj.isEmpty && obj.validate && obj.parse)) {
            const newType = types.get(obj.type)
            if (obj.isEmpty) { newType.isEmpty = () => obj.isEmpty(arg, message, obj) && newType.isEmpty(arg, message, obj) }
            if (obj.validate) { newType.validate = () => obj.validate(arg, message, obj) && newType.validate(arg, message, obj) }
            if (obj.isEmpty) { newType.parse = () => obj.parse(newType.parse(arg, message, obj), message, obj) }

            type = newType
        } else {
            throw new TypeError(`Object "${obj.name}" in command "${command.name}" must have either a type or properties isEmpty, validate and parse.`)
        }

        let def = null
        if (obj.default == null || obj.default == undefined) {
            if (await type.isEmpty(arg, message, obj)) {
                throw {
                    error: true,
                    id: "ARG_EMPTY",
                    ...obj
                }
            }
        } else {
            def = obj.default
        }

        const isValid = (await type.validate(arg, message, obj));
        /* if (!isValid) {
            return 3
        } */
        if (isValid.error) {
            throw {
                ...isValid,
                ...obj
            };
        }

        if (!isValid) {
            if ((def == null || def == undefined))
                throw {
                    error: true,
                    id: "GENERIC_INVALID",
                    ...obj
                };

            argsObject[obj.name] = (typeof def === 'function' ? await def(message) : def);
            // if (command.slideArgs)
            //     args[i+1] = `${args[i] ?? ""} ${args[i+1] ?? ""}`.trim();
        } else argsObject[obj.name] = (await type.isEmpty(arg, message, obj)) ? (typeof def === 'function' ? await def(message) : def) : await type.parse(arg, message, obj)
    }

    return argsObject
}

/**
 * @param {import("discord.js").Message} message 
 * @param {string} argString 
 * @param {import("discord.js").Command} command
 * 
 * @returns {[string, Object.<string, string | boolean | number | Array<string | boolean | number>>]}
 */
function parseFlags(argString) {
    const re = () => /(?:^|\s)(?:--|—)[^\s=]+(?:=(?<!(?:--|—))(?:"([^"]*)"|[^\s]*))?/g
    const split = argString.match(re())

    /** @type {Object.<string, string | boolean | number | Array<string | boolean | number>>} */
    const flags = {}
    // Shorthand for "if (split) { split.forEach(...); }".
    split && split.forEach(arg => {
        arg = arg.trim()
        if (!arg.startsWith('--') && !arg.startsWith("—")) return
        const re = /(?<!(?:--))("|')([^]*)\1$/g

        let name = arg.startsWith("—") ? arg.substr(1) : arg.substr(2)
        if (!name || name == '=') { return }
        name = name.split('=')[0].toLowerCase()

        function addFlag(n, c) {
            // if (flags[n] && !Array.isArray(flags[n])) {
            //     flags[n] = [
            //         flags[n], c
            //     ]
            // } else if (Array.isArray(flags[n])) { flags[n].push(c) } else flags[n] = c
            flags[n] = c
        }

        let match
        // eslint-disable-next-line no-cond-assign
        if (match = re.exec(arg)) {
            let f = match[2]
            if (!isNaN(f) && parseInt(f) < Number.MAX_SAFE_INTEGER) { f = parseInt(f) }
            addFlag(name, f.toString())
        } else if (arg.includes('=')) {
            let f = arg.split('=')[1]
            if (!isNaN(f) && parseInt(f) < Number.MAX_SAFE_INTEGER) { f = parseInt(f) }
            addFlag(name, f.toString())
        } else addFlag(name, "true")
    })

    return [argString.replace(re(), ''), flags]
}

/**
 * Splits a string into a given number of substrings.
 * Supports quotes.
 *
 * @param {string} argString
 * @param {number} argCount
 * @param {boolean} [allowSingleQuote=true]
 * @returns
 */
function splitArgs(argString, argCount, allowSingleQuote = true) {
    const re = allowSingleQuote ? /\s*(?:("|')([^]*?)\1|(\S+))\s*/g : /\s*(?:(")([^]*?)"|(\S+))\s*/g
    const result = []
    let match = []
    // Large enough to get all items
    argCount = argCount || argString.length
    // Get match and push the capture group that is not null to the result
    while (--argCount && (match = re.exec(argString))) result.push(match[2] || match[3])
    // If text remains, push it to the array as-is (except for wrapping quotes, which are removed)
    if (match && re.lastIndex < argString.length) {
        const re2 = allowSingleQuote ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g
        result.push(argString.substr(re.lastIndex).replace(re2, '$2'))
    }
    return result
}

module.exports = {
    parseArgs,
    parseFlags,
    splitArgs
}