# ModularBot

A Discord bot built around self-contained **modules**. Each module ships its own
commands, locales, config, per-guild settings and database collections, and can
be loaded, enabled, disabled or reloaded at runtime without restarting the bot.

## Installation

1. Clone or download the repository
2. Run `npm install` in the repo folder
3. Copy `.env.example` to `.env`
4. Put your bot token in `.env` (replace `YourBotToken`)
5. Start the bot once with `node index.js`. On first run it writes a `config.yml`
   in the repo root (bot owners, intents, language, error reporting, …) — stop
   the bot, edit that file, then start it again.

Trouble? Open an issue or join the Discord: https://discord.com/invite/rr3PUE7Jc8

> **Path aliases:** the code uses `@structures/*` → `structures/` and
> `@modules/*` → `modules/` (via `module-alias`). Use them in your `require`s.

## Anatomy of a module

A module lives in its own folder, named after the class:

```
modules/Example/
├── Example.js            # the module class (required, must match the folder name)
├── config.yml            # auto-generated from `config` defaults (do not hand-create)
├── commands/             # one file per slash command (auto-loaded)
│   └── example.js
└── locales/              # translations, one file per language
    ├── en-GB.yaml
    └── it.yaml
```

Only `Example.js` is required. `commands/` and `locales/` are picked up
automatically if present.

## Making a module

```js
const Module = require("@structures/Module.js");

module.exports = class Example extends Module {
    constructor(client) {
        super(client, {
            info: "What this module does",   // short description
            version: "1.0.0",                // optional
            events: ["clientReady"],         // Discord.js events this module handles

            // Optional ordering & dependencies (all by module name):
            dependencies: [],                // must be loaded before this one
            runBefore: [],                   // run this module's handlers before these
            runAfter: [],                    // …and after these
            databases: [],                   // Loki collections to provision (see below)

            // Per-module config, persisted to modules/Example/config.yml:
            config: {
                greeting: "Hello, world!",
                retries: 3
            },

            // Per-guild settings, edited in Discord via /settings (see below):
            settings: {
                welcomeMessage: {
                    type: 'string',
                    default: 'Welcome, {user}!',
                    description: 'Sent when a member joins.'
                }
            }
        });
    }

    // One method per declared event; named exactly after the event.
    async clientReady(client) {
        this.logger.info("Example is ready!");
        this.logger.info(`greeting = ${this.config.get('greeting')}`);
    }
}
```

> **Enabling/disabling is not a constructor flag.** Every module on disk is loaded
> at boot; whether it's *enabled* is persisted in the bot database and toggled at
> runtime by the module manager (`client.modules.enable/disable/reload(name)`). A
> newly added module starts enabled by default.

### Lifecycle hooks

Override any of these (all optional, all `async`):

| Hook | When |
|---|---|
| `init(client)`    | once after construction, before commands/events are wired |
| `start(client)`   | when the module becomes enabled (default: loads its commands) |
| `stop(client)`    | when the module is disabled (default: clears its commands) |
| `destroy(client)` | once on unload, after `stop` |

Event handlers receive an extra trailing `ctx` argument — call
`ctx.stopPropagation()` to stop later modules from seeing that event.

## Config (per-module, file-based)

`config` is a map of `key → default`. On first load it's written to
`modules/<Name>/config.yml`; missing keys are back-filled from the defaults.
Read/write it through `this.config`:

```js
this.config.get('greeting');          // dot-paths work: this.config.get('a.b')
this.config.set('retries', 5);
```

Use config for **bot-operator** settings that live in a file. Use **settings**
(below) for things server admins change from inside Discord.

## Settings (per-guild, schema-driven)

`settings` is a **schema**: each key declares a `type`, a `default`, an optional
`description` and an optional `validate` hook. Values are stored per guild and
edited in Discord with the `/settings` command — each type renders the right
editor (toggle, channel/role/user picker, dropdown, …). Read them in code:

```js
const mgr = this.settings;                       // the module's SettingsManager
mgr.getKey(guildId, 'welcomeMessage');           // one value (with default applied)
mgr.get(guildId).settings;                       // the whole settings object
```

### Field (leaf) types

| `type` | Editor | Stored value |
|---|---|---|
| `string` `number` `integer` `boolean` | text / toggle | scalar |
| `snowflake` | text (raw ID) | string ID |
| `channel` `role` `user` | native Discord picker | ID |
| `enum:a\|b\|c` | dropdown | one of the choices |
| `array<T>` | multi-select / one-per-line | array of `T` (any scalar above) |

```js
settings: {
    featureEnabled: { type: 'boolean', default: true, description: 'Master switch.' },
    greetingStyle:  { type: 'enum:friendly|formal|silly', default: 'friendly' },
    logChannel:     { type: 'channel', default: null },
    staffRoles:     { type: 'array<role>', default: [] },
    prefix:         { type: 'string', default: '!',
                      validate: v => v.length <= 3 || 'must be at most 3 characters' }
}
```

The `validate` hook runs after type validation; return `true` to accept, `false`
or a message string to reject.

### Structured types: `object` and `list`

Settings can also nest, to any depth, with two structural types. `/settings`
renders these as **drill-down screens** instead of a single modal:

- **`object`** — a fixed set of named `fields` (a sub-schema).
- **`list`** — a variable-length sequence of `item`s (add / remove / reorder).

**One rule:** an `object` never contains another `object` directly — a grouping
of objects is always a `list` (an array of objects). So nesting alternates
object → list → object → list. A single optional sub-object is modelled as a
`list` with `maxItems: 1`.

```js
settings: {
    // A single nested object.
    welcomeCard: {
        type: 'object',
        description: 'Welcome card appearance.',
        fields: {
            enabled: { type: 'boolean', default: true },
            title:   { type: 'string',  default: 'Welcome!' },
            accent:  { type: 'enum:blurple|green|red|gold', default: 'blurple' },
            channel: { type: 'channel', default: null },
            pingRoles: { type: 'array<role>', default: [] }
        }
    },

    // A list of objects, keyed by a stable `value` id, with a nested list.
    ticketCategories: {
        type: 'list',
        label: 'name',          // which item field to show as the row title
        default: [],
        item: {
            type: 'object',
            fields: {
                value: { type: 'string', description: 'Internal id (stable).' },
                name:  { type: 'string' },
                supportRoles: { type: 'array<role>', default: [] },
                subcategories: {           // list-in-object-in-list
                    type: 'list', label: 'name', default: [],
                    item: { type: 'object', fields: {
                        value: { type: 'string' },
                        name:  { type: 'string' }
                    } }
                }
            }
        }
    }
}
```

Reading nested settings gives back the fully-built value. For id-keyed
collections, rebuild a `Map` at read time:

```js
const cats = this.settings.getKey(guildId, 'ticketCategories');
const byId = new Map(cats.map(c => [c.value, c]));
const commercial = byId.get('commercial');
```

> Field names and keys may not contain `:` or `.` (reserved by the settings UI).
> This is enforced when the schema is built.

## Commands

Drop one file per command in `modules/<Name>/commands/`. They're auto-loaded:

```js
const Command = require('@structures/Command.js');

module.exports = class PingCommand extends Command {
    constructor(client, module) {
        super(client, module, {
            name: 'ping',
            description: 'Check latency.',
            cooldown: 3
            // options, contexts, defaultMemberPermissions, minLevel … also available
        });
    }

    async run(client, interaction, module) {
        await interaction.reply(this.t('messages.pong', interaction));
    }
}
```

## Localization

Put one YAML per language in `modules/<Name>/locales/` (e.g. `en-GB.yaml`,
`it.yaml`). Look strings up with `this.t(key, interaction, vars)` in a module, or
`this.t(...)` in a command (which scopes the key under `commands.<name>.`). The
language is resolved per interaction (user preference → guild default → Discord
locale → bot default).

## Databases

Declare the Loki collections your module needs; a per-module database file is
provisioned automatically:

```js
databases: ['guilds', 'logs']
```

```js
const guilds = this.collection('guilds');   // throws if not declared
guilds.insert({ id: guildId, joined: Date.now() });
```

Declaring `settings` also provisions a `settings` collection for you — you don't
list it in `databases`.

## Special thanks

- [@Miky88](https://github.com/Miky88) — author & maintainer
- [@Samplasion](https://github.com/Samplasion)
- [@GalaxyVinci05](https://github.com/GalaxyVinci05)
- [@Just1diaxx](https://github.com/Just1diaxx)
