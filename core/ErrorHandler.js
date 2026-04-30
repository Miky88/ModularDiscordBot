const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const Logger = require('./Logger.js');

const DEFAULTS = {
    channelId: null,
    notifyOwners: false,
    dedupWindowMs: 60000,
    exitOnUncaught: true,
    logsDir: 'logs'
};

/**
 * Centralized error sink. Hooks process- and discord.js-level error events,
 * exposes `capture(err, context)` for in-app error reporting, writes both a
 * structured JSONL stream and a human-readable log file (date-rotated),
 * deduplicates floods, and optionally posts a formatted embed to a Discord
 * channel and/or DMs the bot's owners.
 */
module.exports = class ErrorHandler {
    /**
     * @param {import('..')} client
     * @param {Partial<typeof DEFAULTS>} [opts]
     */
    constructor(client, opts = {}) {
        this.client = client;
        this.config = { ...DEFAULTS, ...opts };
        this.logger = new Logger('ErrorHandler', false);
        this._dedup = new Map();
        this._exiting = false;

        this._logsDir = path.resolve(process.cwd(), this.config.logsDir);
        if (!fs.existsSync(this._logsDir)) fs.mkdirSync(this._logsDir, { recursive: true });

        this._streams = { json: null, text: null, date: null };

        this._installProcessHooks();
        this._installClientHooks();
    }

    _installProcessHooks() {
        process.on('uncaughtException', (err, origin) => {
            this.capture(err, { fatal: true, origin, source: 'uncaughtException' });
            if (this.config.exitOnUncaught) this._gracefulExit(1);
        });
        process.on('unhandledRejection', (reason) => {
            const err = reason instanceof Error ? reason : new Error(String(reason));
            this.capture(err, { fatal: true, source: 'unhandledRejection' });
            if (this.config.exitOnUncaught) this._gracefulExit(1);
        });
        process.on('warning', (warning) => {
            this.capture(warning, { source: 'nodeWarning', severity: 'warn' });
        });
        process.on('exit', () => {
            try { this._streams.json?.end(); } catch {}
            try { this._streams.text?.end(); } catch {}
        });
    }

    _installClientHooks() {
        this.client.on('error', (err) => this.capture(err, { source: 'discord.js' }));
        this.client.on('shardError', (err, shardId) => this.capture(err, { source: 'shard', shardId }));
        this.client.on('warn', (msg) => this.capture(new Error(msg), { source: 'discord.js', severity: 'warn' }));
    }

    _streamsForToday() {
        const date = new Date().toISOString().slice(0, 10);
        if (this._streams.date !== date) {
            try { this._streams.json?.end(); } catch {}
            try { this._streams.text?.end(); } catch {}
            this._streams = {
                date,
                json: fs.createWriteStream(path.join(this._logsDir, `errors-${date}.jsonl`), { flags: 'a' }),
                text: fs.createWriteStream(path.join(this._logsDir, `errors-${date}.log`), { flags: 'a' })
            };
        }
        return this._streams;
    }

    /**
     * Report an error. Returns synchronously after writing to console + files;
     * the optional Discord report is fired-and-forgotten.
     * @param {Error | unknown} err
     * @param {object} [context]
     * @param {string} [context.module]
     * @param {string} [context.event]
     * @param {string} [context.command]
     * @param {string} [context.userId]
     * @param {string} [context.guildId]
     * @param {string} [context.source]
     * @param {boolean} [context.fatal]
     * @param {'error' | 'warn' | 'fatal'} [context.severity]
     */
    capture(err, context = {}) {
        const error = err instanceof Error ? err : new Error(String(err));
        const severity = context.severity || (context.fatal ? 'fatal' : 'error');
        const firstFrame = (error.stack || '').split('\n')[1] || '';
        const dedupKey = `${error.name}|${error.message}|${firstFrame}`;
        const now = Date.now();
        const previous = this._dedup.get(dedupKey);

        if (previous && now - previous.timestamp < this.config.dedupWindowMs) {
            previous.count = (previous.count || 1) + 1;
            return;
        }
        const suppressedCount = previous?.count;
        this._dedup.set(dedupKey, { timestamp: now });

        const record = {
            timestamp: new Date().toISOString(),
            severity,
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...context
        };

        const headline = this._headline(record, suppressedCount);
        if (severity === 'warn') this.logger.warn(headline);
        else this.logger.error(headline);
        if (error.stack && severity !== 'warn') console.error(error.stack);

        try {
            const { json, text } = this._streamsForToday();
            json.write(JSON.stringify(record) + '\n');
            text.write(this._formatText(record, suppressedCount) + '\n');
        } catch (writeErr) {
            console.error('[ErrorHandler] Failed to write log:', writeErr);
        }

        if (severity !== 'warn' && (this.config.channelId || this.config.notifyOwners))
            this._reportDiscord(record).catch(() => { /* already on disk */ });
    }

    _headline(r, suppressed) {
        const parts = [r.message];
        if (r.module) parts.push(`module=${r.module}`);
        if (r.command) parts.push(`command=${r.command}`);
        if (r.event) parts.push(`event=${r.event}`);
        if (suppressed) parts.push(`(${suppressed} prior duplicates suppressed)`);
        return parts.join(' | ');
    }

    _formatText(r, suppressed) {
        let out = `[${r.timestamp}] [${r.severity}] ${r.name}: ${r.message}`;
        const meta = [];
        if (r.source) meta.push(`source=${r.source}`);
        if (r.module) meta.push(`module=${r.module}`);
        if (r.event) meta.push(`event=${r.event}`);
        if (r.command) meta.push(`command=${r.command}`);
        if (r.userId) meta.push(`user=${r.userId}`);
        if (r.guildId) meta.push(`guild=${r.guildId}`);
        if (suppressed) meta.push(`suppressed=${suppressed}`);
        if (meta.length) out += `\n  ${meta.join(' ')}`;
        if (r.stack) out += `\n${r.stack}`;
        return out;
    }

    async _reportDiscord(record) {
        if (!this.client.isReady?.()) return;

        const embed = new EmbedBuilder()
            .setTitle(`${record.severity === 'fatal' ? '\u{1F525} Fatal' : '\u{26A0} Error'}: ${record.name || 'Error'}`)
            .setDescription('```\n' + this._truncate(record.message || '(no message)', 1000) + '\n```')
            .setColor(record.severity === 'fatal' ? 0xff3b3b : 0xe67e22)
            .setTimestamp(new Date(record.timestamp));

        const fields = [];
        if (record.source) fields.push({ name: 'Source', value: String(record.source), inline: true });
        if (record.module) fields.push({ name: 'Module', value: record.module, inline: true });
        if (record.event) fields.push({ name: 'Event', value: record.event, inline: true });
        if (record.command) fields.push({ name: 'Command', value: record.command, inline: true });
        if (record.userId) fields.push({ name: 'User', value: `<@${record.userId}>`, inline: true });
        if (record.guildId) fields.push({ name: 'Guild', value: record.guildId, inline: true });
        if (fields.length) embed.addFields(fields);

        if (record.stack)
            embed.addFields({ name: 'Stack', value: '```\n' + this._truncate(record.stack, 1000) + '\n```' });

        if (this.config.channelId) {
            try {
                const channel = await this.client.channels.fetch(this.config.channelId);
                if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
            } catch { /* ignore — channel missing or no permissions */ }
        }

        if (this.config.notifyOwners) {
            const owners = this.client.config?.get('owners') || [];
            for (const ownerId of owners) {
                try {
                    const user = await this.client.users.fetch(ownerId);
                    await user.send({ embeds: [embed] });
                } catch { /* DMs closed or user unreachable */ }
            }
        }
    }

    _truncate(s, max) {
        if (typeof s !== 'string') s = String(s);
        return s.length <= max ? s : s.slice(0, max - 16) + '\n…[truncated]';
    }

    _gracefulExit(code) {
        if (this._exiting) return;
        this._exiting = true;
        this.logger.warn('Exiting due to uncaught error — process supervisor should restart the bot.');
        try { this._streams.json?.end(); } catch {}
        try { this._streams.text?.end(); } catch {}
        setTimeout(() => process.exit(code), 250);
    }
};
