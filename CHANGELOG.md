# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this file starts at the point where the database, error handling and i18n
were refactored — earlier history lives in `git log`.

## [Unreleased]

### Added
- **Per-guild custom permission level system** ([`core/Permissions.js`](core/Permissions.js)).
  - Built-in level IDs (`member`, `helper`, `moderator`, `admin`) seeded into every guild on first read. Built-ins are immutable (cannot be deleted) so module gates referencing them never dangle.
  - Admins can rename and reweight any level, and add fully custom levels (any ID, any weight) — letting them insert e.g. `senior_mod` between `moderator` and `admin`.
  - Roles bind to levels at the level (`level.roles: [roleId, …]`); a role can belong to multiple levels and the resolver takes max weight.
  - User overrides (`userOverrides[userId] = levelId`) and per-guild gate overrides (`commandOverrides[name]`, `settingOverrides['Module.key']`) for fine-grained admin control.
  - Resolver short-circuits on bot OWNER PowerLevel, guild owner, and Discord `Administrator` perm.
  - Storage: dedicated `Permissions` Loki handle with a single `guilds` collection.
- **Schema-driven `SettingsManager`** ([`core/SettingsManager.js`](core/SettingsManager.js)).
  - Each setting key declares `{ type, default, description?, validate? }`. Built-in types: `string`, `boolean`, `number`, `integer`, `channel` / `role` / `user` / `snowflake`, `array<X>`, and `enum:a|b|c`.
  - String inputs from slash commands are coerced (`"true"` → `true`, mention syntax stripped from snowflakes, etc.) before validation.
  - Custom per-key `validate` functions can return `true` / `false` / a string error message.
  - Per-guild settings record auto-backfills any new keys added in later schema versions.
- **`/permissions` slash command** ([`modules/Utility/commands/permissions.js`](modules/Utility/commands/permissions.js)) for guild admins:
  - `view` — show the level ladder with bound roles and active overrides.
  - `level create | edit | delete` — manage the level ladder (built-ins refuse deletion).
  - `role bind | unbind` — attach roles to levels.
  - `user` — set or clear a user-specific level override.
  - `override command | setting` — re-gate a specific command or `Module.key` to a different level in this guild.
  - Autocomplete for level IDs, command names, and `Module.key` setting paths.

### Changed
- **`Permissions.check()` is now override-driven, not requirement-driven.** Modules don't ship custom-level defaults; the resolver only enforces a gate when an admin has set an override (`commandOverrides[]` / `settingOverrides[]`). Discord's `defaultMemberPermissions` remains the baseline for command visibility/usage. Signature: `check(member, { commandName?, settingKey? })`.
- **`/settings` command rewritten** ([`modules/Utility/commands/settings.js`](modules/Utility/commands/settings.js)):
  - Goes through the new schema-driven API.
  - Passes `actor: interaction.member` so per-guild setting overrides are enforced.
  - View embed shows each key's value and declared type.
  - Restored `defaultMemberPermissions: [ManageGuild]` as the baseline visibility gate.
- **`InteractionCommandHandler`** ([`modules/InteractionCommandHandler/InteractionCommandHandler.js`](modules/InteractionCommandHandler/InteractionCommandHandler.js)) checks `client.permissions.check(member, { commandName })` for every guild command — only enforces when an admin has set an override.
- **Utility module's `defaultServerLanguage`** declared in the new schema shape.

### Removed
- **`Command.requires` field.** Previously let modules declare a guild-level requirement (e.g. `requires: 'moderator'`); replaced by Discord-native default + admin-applied per-guild overrides.
- **Per-key `requires` in setting schemas.** Same reasoning — modules don't ship gates of their own.
- Stale `BotClient` runtime-`require` references in `core/Database.js` and `core/Module.js` (they were JSDoc-only but executed `require('../index.js')`, blocking standalone loading of those files outside `node index.js`).

---

## [2026-04-30] — Database, error handling, and i18n refactor

Commit [`ac6e616`](https://github.com/) (`Refactor database, errors, and i18n; fix ping; tighten config`).

### Added
- **`core/DatabaseHandle.js`** — wraps a single Loki file plus the named collections inside it. Async `ready()` for autoload, `collection(name)` / `addCollection(name, opts)` for access, mkdir-recursive on the data dir.
- **`core/ErrorHandler.js`** — central error sink:
  - Hooks `process.on('uncaughtException')`, `unhandledRejection`, `warning`, plus discord.js `error` / `shardError` / `warn`.
  - `capture(err, context)` API for explicit reporting from anywhere in the bot.
  - Writes `logs/errors-YYYY-MM-DD.log` (human) and `logs/errors-YYYY-MM-DD.jsonl` (machine) via async write streams with date rotation.
  - 60s deduplication window — repeated identical errors collapse with a suppressed-count tag rather than flooding logs.
  - Optional Discord-side reporting via `config.errorReporting.channelId` and/or `notifyOwners`. Posts a properly formatted, color-coded embed; silently no-ops if neither is configured.
  - `exitOnUncaught: true` by default — flushes logs and exits with code 1 so a process supervisor (Docker `restart: always`, pm2, systemd) can bring the bot back to a clean state.
- **`Database.migrate({ source, dryRun, removeOriginal })`** — one-shot helper that pulls legacy `module_<X>` and `settings_<X>` collections out of the monolithic `database.db` and into the new per-module files. Reuses the open core handle when source overlaps to avoid double-open races.
- **`languageName(code, displayIn?)`** on the i18n manager — uses `Intl.DisplayNames` to render any locale code in any locale. Replaces the prior reliance on a `name:` field at the top of each locale file.
- **i18n auto-sync.** On every boot, missing keys in non-reference locale files are stubbed with their dotted path as the value, so translators can grep for untranslated entries and end users see a clear placeholder until a translation lands.
- **i18n locale fallback chain.** `resolveLanguage()` does exact match → same-base match (`en-US` → first `en-*`) → default. Discord's `en-US` interaction locale now resolves to `en-GB` translations cleanly.
- **i18n optional hot reload** via `fs.watch` on per-module `locales/` dirs (off by default; enable with `i18n.hotReload: true`).
- **i18n boot-time coverage report** (`Loaded 2 language(s) — en-GB (ref): 100 | it: 100/100`).
- **`config.yml` blocks** for `errorReporting` and `i18n`. ConfigurationManager now persists newly-added defaults to disk on startup so existing installations pick them up.

### Changed
- **`core/Database.js` is now a registry** of `DatabaseHandle`s. The bot ships a built-in `core` handle (still backed by `database.db`, housing the `users` collection) plus one handle per module that opts in. Modules declare their per-module file via the `databases` option (`true` for a single `default` collection or `['guilds', 'logs', …]` for named collections).
- **`Module.js` `databases` option** replaces the old `usesDB`. `module.db` returns the `DatabaseHandle`, so `this.db.collection('guilds').insert(…)` (or the convenience proxy `this.db.guilds`) is the new shape. `saveData(collection, data)` updated accordingly.
- **`ModuleManager`** stops poking into `client.database.db` directly — registers each module's handle through `database.register(name, …)`.
- **`SettingsManager`** routes through the module's `DatabaseHandle` (collection `settings`) rather than reaching into `client.database.db[settings_<Module>]`.
- **`LocalizationManager` rewritten.** Loads strictly from `modules/<Module>/locales/<lang>.<yml|yaml>`. Per-module strings merge into the language tree under `modules.<Module>`. The global `/locales/` directory was deleted entirely — there's no bot-level string file anymore.
- **All previously-global module strings migrated** into their module's `locales/` directory:
  - `modules/System/locales/`
  - `modules/Utility/locales/`
  - `modules/InteractionCommandHandler/locales/`
- **`ConfigurationManager`** tracks an explicit `mutated` flag so newly-added defaults actually persist when present in the schema but missing from the user's `config.yml`. Previously a key-count comparison made the rewrite a no-op for additions.
- **i18n object values are no longer JSON-stringified.** `t()` returns objects/arrays as-is for callers that want them; `getLocalizationObject()` continues to return string maps for Discord command localizations and now skips auto-sync stubs (so Discord never receives a dotted path as a localized command name).
- **`Module.t()` language resolution** order matches its own comment: user-forced → guild default → Discord interaction locale → bot default.

### Fixed
- **`/ping`** broke under discord.js v14.26+ because `interaction.reply({ withResponse: true })` returns an `InteractionCallbackResponse`, not the message — pulled the message off `response.resource.message` instead.
- **Pre-existing `ConfigurationManager` bug** where missing-but-defaulted keys were merged into memory but never written back to disk.

### Removed
- **`Module.usesDB`** option — replaced by `databases`.
- **The global `/locales/` directory** (and its `en-GB.yaml` / `it.yaml`).
- **`Database.reconfigure()`** and the dual-tracked `Database.collections` array — both became dead code in the registry model.

### Infrastructure
- `.gitignore`: added `data/` (per-module Loki files) and `logs/` (ErrorHandler output).
