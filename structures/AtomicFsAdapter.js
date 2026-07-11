const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const Logger = require('./Logger.js');

/** Rename/unlink errors worth retrying: another handle (antivirus, indexer,
 *  editor) is holding the file open. Common on Windows, transient. */
const TRANSIENT = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY']);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Crash-safe Loki persistence adapter.
 *
 * Loki's own LokiFsAdapter writes a `~` temp file and renames it, which is
 * already better than truncating in place — but it never fsyncs, so a power
 * cut can leave the rename durable while the data blocks are not, and the file
 * comes back zero-length or full of NULs. It also has no recovery path: a
 * corrupt file makes autoload throw, the handle starts empty, and the 1s
 * autosave then overwrites the file with the empty database.
 *
 * This adapter closes both holes:
 *   save: write temp -> fsync temp -> rotate current to .bak -> rename temp
 *         over current -> fsync directory. The target file is therefore never
 *         observed partially written; a crash at any point leaves either the
 *         previous generation or the new one, both complete.
 *   load: validate the primary; on corruption quarantine it to `.corrupt` (so
 *         autosave can't overwrite the evidence) and fall back to `.bak`.
 *
 * Loki serializes saves per database (`throttledSaves`, on by default), so a
 * single fixed temp path per file is safe — no two saves for the same db are
 * ever in flight at once.
 */
module.exports = class AtomicFsAdapter {
    /**
     * @param {object} [opts]
     * @param {boolean} [opts.backup=true] Keep the previous generation as `<file>.bak` and recover from it.
     * @param {boolean} [opts.fsync=true] fsync the temp file (and its directory) before/after the rename.
     * @param {number} [opts.retries=5] Retries for a transient rename/unlink failure.
     * @param {number} [opts.retryDelayMs=25] Base backoff between retries (grows linearly).
     * @param {Logger} [opts.logger]
     */
    constructor({ backup = true, fsync = true, retries = 5, retryDelayMs = 25, logger } = {}) {
        this.backup = backup;
        this.fsync = fsync;
        this.retries = retries;
        this.retryDelayMs = retryDelayMs;
        this.logger = logger || new Logger('DB:fs');
    }

    /**
     * @param {string} dbname
     * @param {(data: string | Error | null) => void} callback Loki's contract: a
     *   string is parsed as the database, an Error aborts the load, null means
     *   "no such database, start fresh".
     */
    loadDatabase(dbname, callback) {
        this._load(dbname).then(callback, (err) => callback(err instanceof Error ? err : new Error(err)));
    }

    /**
     * @param {string} dbname
     * @param {string} dbstring Serialized database.
     * @param {(err?: Error) => void} callback
     */
    saveDatabase(dbname, dbstring, callback) {
        this._save(dbname, dbstring).then(() => callback(), (err) => callback(err instanceof Error ? err : new Error(err)));
    }

    /**
     * @param {string} dbname
     * @param {(err?: Error) => void} callback
     */
    deleteDatabase(dbname, callback) {
        Promise.all([
            this._remove(dbname),
            this._remove(`${dbname}.tmp`),
            this._remove(`${dbname}.bak`)
        ]).then(() => callback(), (err) => callback(err instanceof Error ? err : new Error(err)));
    }

    /** @private @returns {Promise<string | null>} */
    async _load(dbname) {
        const primary = await this._readValid(dbname);
        if (primary !== null) return primary;

        const exists = fs.existsSync(dbname);
        if (exists) {
            // Present but unparseable. Move it out of the way *before* returning:
            // autosave fires a second later and would otherwise bury it.
            await this._quarantine(dbname);
            this.logger.error(`'${dbname}' is corrupt — quarantined to '${dbname}.corrupt'.`);
        }

        const backup = this.backup ? await this._readValid(`${dbname}.bak`) : null;
        if (backup !== null) {
            this.logger.warn(`Recovered '${dbname}' from its backup (${exists ? 'primary was corrupt' : 'primary was missing'}).`);
            return backup;
        }

        if (exists) this.logger.error(`No usable backup for '${dbname}' — starting from an empty database.`);
        return null; // fresh database
    }

    /**
     * Read a file and confirm it parses. Returns the raw string (Loki owns the
     * real deserialization; this is only a corruption check) or null if the file
     * is absent, empty, or not valid JSON.
     * @private @returns {Promise<string | null>}
     */
    async _readValid(file) {
        let data;
        try {
            data = await fsp.readFile(file, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') return null;
            throw err;
        }

        if (!data.length) return null; // truncated by a pre-adapter crash
        try {
            JSON.parse(data);
        } catch {
            return null;
        }
        return data;
    }

    /** @private */
    async _save(dbname, dbstring) {
        const tmp = `${dbname}.tmp`;

        const handle = await fsp.open(tmp, 'w');
        try {
            await handle.writeFile(dbstring, 'utf8');
            // Durability barrier: without this the rename below can hit the disk
            // before the bytes do, which is exactly how you get a zero-length db.
            if (this.fsync) await handle.sync();
        } finally {
            await handle.close();
        }

        // Two renames, no copy: the old generation becomes the backup, the temp
        // becomes the primary. The window where the primary is absent is a single
        // syscall wide, and _load() covers it by falling back to .bak.
        if (this.backup) await this._rename(dbname, `${dbname}.bak`, { missingOk: true });
        await this._rename(tmp, dbname);
        await this._syncDir(path.dirname(dbname));
    }

    /** @private */
    async _rename(from, to, { missingOk = false } = {}) {
        await this._retry(() => fsp.rename(from, to), (err) => missingOk && err.code === 'ENOENT');
    }

    /** @private */
    async _remove(file) {
        await this._retry(() => fsp.unlink(file), (err) => err.code === 'ENOENT');
    }

    /** @private */
    async _quarantine(dbname) {
        try {
            await this._rename(dbname, `${dbname}.corrupt`);
        } catch (err) {
            this.logger.warn(`Could not quarantine '${dbname}': ${err.message}`);
        }
    }

    /**
     * fsync the containing directory so the rename itself survives a power cut.
     * Windows has no directory handle to sync and some filesystems reject it —
     * in both cases the rename is still atomic, we just lose the ordering
     * guarantee, so a failure here is not worth failing the save over.
     * @private
     */
    async _syncDir(dir) {
        if (!this.fsync || process.platform === 'win32' || !dir) return;
        let handle;
        try {
            handle = await fsp.open(dir, 'r');
            await handle.sync();
        } catch { /* best effort */ } finally {
            await handle?.close().catch(() => {});
        }
    }

    /**
     * Run `op`, retrying while the failure looks transient (a file lock held by
     * antivirus or a search indexer — routine on Windows, gone in milliseconds).
     * `ignore(err)` swallows an expected failure instead of throwing.
     * @private
     */
    async _retry(op, ignore = () => false) {
        for (let attempt = 0; ; attempt += 1) {
            try {
                return await op();
            } catch (err) {
                if (ignore(err)) return;
                if (attempt >= this.retries || !TRANSIENT.has(err.code)) throw err;
                await sleep(this.retryDelayMs * (attempt + 1));
            }
        }
    }
};
