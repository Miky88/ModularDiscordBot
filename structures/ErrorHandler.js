const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const Logger = require('./Logger.js');
const { truncate } = require('./lib/InteractionHelpers.js');

const DEFAULTS = {
    channelId: null,
    notifyOwners: false,
    dedupWindowMs: 60000,
    exitOnUncaught: true,
    logsDir: 'logs',
    // Discord report backpressure: at most one report in flight, spaced by
    // `reportThrottleMs`; past `reportQueueMax` buffered, the rest collapse into
    // a single suppression summary.
    reportQueueMax: 20,
    reportThrottleMs: 1000
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
        this.logger = new Logger('ErrorHandler');
        this._dedup = new Map();
        this._exiting = false;

        // Serial, throttled, bounded queue for outbound Discord reports — so a
        // flood of distinct errors can't spawn concurrent channel fetches + owner
        // DMs without backpressure.
        this._reportQueue = [];
        this._reportDraining = false;
        this._reportsDropped = 0;

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
        // Best-effort only: 'exit' runs synchronously so a stream end() here
        // can't await its async flush. The reliable flush lives in
        // `_closeStreams()` (used by `_gracefulExit`); this just covers exits
        // that don't go through it, and is a no-op after a graceful exit (which
        // already closed the streams).
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
            this._enqueueDiscordReport(record);
    }

    /**
     * Buffer a record for Discord reporting. The queue is bounded — past the
     * cap, reports are counted and collapsed into a single suppression summary
     * once the backlog drains, rather than buffered without limit.
     */
    _enqueueDiscordReport(record) {
        if (this._reportQueue.length >= this.config.reportQueueMax) {
            this._reportsDropped++;
            return;
        }
        this._reportQueue.push(record);
        this._drainReportQueue();
    }

    /**
     * Drain the report queue one record at a time, throttled, so reports are
     * never sent concurrently. Records enqueued while draining are picked up by
     * the running loop; the `_reportDraining` guard prevents a second drainer.
     */
    async _drainReportQueue() {
        if (this._reportDraining) return;
        this._reportDraining = true;
        try {
            while (this._reportQueue.length || this._reportsDropped) {
                // Backlog clear but some were dropped → emit one summary.
                if (!this._reportQueue.length && this._reportsDropped) {
                    const dropped = this._reportsDropped;
                    this._reportsDropped = 0;
                    this._reportQueue.push({
                        timestamp: new Date().toISOString(),
                        severity: 'warn',
                        name: 'ErrorHandler',
                        message: `${dropped} further error report(s) suppressed to avoid flooding.`
                    });
                }
                const record = this._reportQueue.shift();
                try { await this._reportDiscord(record); }
                catch { /* already on disk */ }
                if (this._reportQueue.length || this._reportsDropped)
                    await new Promise(resolve => setTimeout(resolve, this.config.reportThrottleMs));
            }
        } finally {
            this._reportDraining = false;
        }
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
            .setDescription('```\n' + truncate(record.message || '(no message)', 1000, '\n…[truncated]') + '\n```')
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
            embed.addFields({ name: 'Stack', value: '```\n' + truncate(record.stack, 1000, '\n…[truncated]') + '\n```' });

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

    /**
     * Flush and close the log streams, resolving once both have actually
     * finished writing (the `end()` callback fires on flush) — or after a 2s
     * safety timeout so a stalled flush can't hang shutdown. Unlike a bare
     * `.end()` in `process.on('exit')` (which can't await), this waits for
     * buffered data, important when the final write is a large stack trace.
     * @returns {Promise<void>}
     */
    _closeStreams() {
        const streams = [this._streams.json, this._streams.text].filter(s => s && !s.destroyed);
        this._streams = { json: null, text: null, date: null };
        if (!streams.length) return Promise.resolve();
        const flushed = Promise.all(streams.map(s => new Promise(resolve => s.end(resolve))));
        const safety = new Promise(resolve => { const t = setTimeout(resolve, 2000); t.unref?.(); });
        return Promise.race([flushed, safety]);
    }

    _gracefulExit(code) {
        if (this._exiting) return;
        this._exiting = true;
        this.logger.warn('Exiting due to uncaught error — process supervisor should restart the bot.');
        // Wait for the log streams to flush before exiting, rather than racing a
        // fixed timer (a large stack trace can take longer than 250ms to write).
        this._closeStreams().finally(() => process.exit(code));
    }
};
