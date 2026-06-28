const { inspect } = require('util');
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');
const { safeReply, truncate } = require('@structures/lib/InteractionHelpers.js');

/** Placeholder substituted for anything that looks like the bot token. */
const TOKEN_DECOY = '[REDACTED]';
/** Matches Discord bot/mfa token shapes so derived/fragmented tokens are caught too. */
const TOKEN_RE = /(?:mfa\.[\w-]{20,})|(?:[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,})/g;
/** Max characters of output rendered in the message (Components v2 caps total text at 4000). */
const MAX_OUTPUT = 3500;
/** Discord modal text-input hard cap. */
const MODAL_INPUT_MAX = 4000;
/** Upper bound on remembered eval sessions (bounded, FIFO eviction). */
const MAX_SESSIONS = 50;

/**
 * Backs the `/eval` command. Renders results with Components v2, keeps a small
 * in-memory store of `messageId → { code, output, isError, ephemeral }` so the
 * Edit / Retry / Send-publicly buttons can act on the original code (which is
 * far too long to round-trip through a customId), and redacts the bot token
 * from every rendered string.
 *
 * Custom-id convention: `eval:<action>`. All eval controls are OWNER-only —
 * on a public message the buttons are visible to everyone, so each component
 * interaction is re-checked against the owners list before doing anything.
 */
module.exports = class EvalUI {
    /**
     * @param {import('../System.js')} systemModule
     */
    constructor(systemModule) {
        this.module = systemModule;
        this.client = systemModule.client;
        /** @type {Map<string, { code: string, output: string, isError: boolean, ephemeral: boolean }>} */
        this._sessions = new Map();
    }

    /** Localize a UI string under `commands.eval.ui.<key>`. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.eval.ui.${key}`, interaction, vars);
    }

    /**
     * Slash-command entry: evaluate `code` and reply with the result panel.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {string} code
     * @param {boolean} ephemeral
     */
    async open(interaction, code, ephemeral) {
        const state = await this._evaluate(code, interaction, ephemeral);
        const { components, flags } = this._render(interaction, state);
        await interaction.reply({ components, flags: flags | (ephemeral ? MessageFlags.Ephemeral : 0) });
        const msg = await interaction.fetchReply();
        this._remember(msg.id, state);
    }

    /**
     * Dispatch an `eval:*` component / modal interaction.
     * @param {import('discord.js').Interaction} interaction
     */
    async handle(interaction) {
        const id = interaction.customId;
        if (!id?.startsWith('eval:')) return false;

        // Owner-only. Component interactions never get `interaction.user.data`
        // populated (only command interactions do), so check owners directly.
        const owners = this.client.config.get('owners') || [];
        if (!owners.includes(interaction.user.id)) {
            await safeReply(interaction, { content: this._t('not-allowed', interaction), flags: MessageFlags.Ephemeral });
            return true;
        }

        const action = id.split(':')[1];
        try {
            switch (action) {
                case 'edit':       return await this._showEditModal(interaction);
                case 'edit_modal': return await this._submitEdit(interaction);
                case 'retry':      return await this._retry(interaction);
                case 'publish':    return await this._publish(interaction);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'EvalUI', userId: interaction.user?.id });
            await safeReply(interaction, {
                content: ':x: ' + this._redact(err?.message || String(err)),
                flags: MessageFlags.Ephemeral
            });
        }
        return true;
    }

    async _showEditModal(interaction) {
        const session = this._sessions.get(interaction.message?.id);
        const modal = new ModalBuilder()
            .setCustomId('eval:edit_modal')
            .setTitle(this._t('modal.title', interaction));
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('code')
                .setLabel(this._t('modal.code-label', interaction))
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(MODAL_INPUT_MAX)
                .setValue(truncate(session?.code ?? '', MODAL_INPUT_MAX, ''))
        ));
        await interaction.showModal(modal);
        return true;
    }

    async _submitEdit(interaction) {
        const code = interaction.fields.getTextInputValue('code');
        const state = await this._evaluate(code, interaction, this._isEphemeral(interaction));
        await interaction.update(this._render(interaction, state));
        this._remember(interaction.message.id, state);
        return true;
    }

    async _retry(interaction) {
        const session = this._sessions.get(interaction.message?.id);
        if (!session) return this._expired(interaction);
        const state = await this._evaluate(session.code, interaction, this._isEphemeral(interaction));
        await interaction.update(this._render(interaction, state));
        this._remember(interaction.message.id, state);
        return true;
    }

    async _publish(interaction) {
        const session = this._sessions.get(interaction.message?.id);
        if (!session) return this._expired(interaction);
        const publicState = { ...session, ephemeral: false };
        await interaction.reply(this._render(interaction, publicState));
        const msg = await interaction.fetchReply();
        this._remember(msg.id, publicState);
        return true;
    }

    async _expired(interaction) {
        await safeReply(interaction, { content: this._t('expired', interaction), flags: MessageFlags.Ephemeral });
        return true;
    }

    /**
     * Evaluate `code` with `client`/`interaction` (and `guild`/`channel`/
     * `member`/`user`) in scope. Always returns a redacted result string.
     */
    async _evaluate(code, interaction, ephemeral) {
        const client = this.client;            // eslint-disable-line no-unused-vars
        const module = this.module;            // eslint-disable-line no-unused-vars
        const { guild, channel, member, user } = interaction; // eslint-disable-line no-unused-vars
        const prepared = String(code).replace(/client\s*\.\s*token/gmi, JSON.stringify(TOKEN_DECOY));

        let output, isError = false;
        try {
            const result = await eval(prepared); // eslint-disable-line no-eval
            output = typeof result === 'string' ? result : inspect(result, { depth: 2 });
        } catch (err) {
            isError = true;
            output = err?.stack || String(err?.message ?? err);
        }

        output = this._redact(output);
        if (output.length > MAX_OUTPUT)
            this.module.logger.log(`[eval] full ${isError ? 'error' : 'output'} (${output.length} chars):\n${output}`);

        return { code, output, isError, ephemeral };
    }

    /** Strip the bot token (and env-var token aliases, and token-shaped strings). */
    _redact(str) {
        let s = String(str ?? '');
        const secrets = [this.client.token, process.env.TOKEN, process.env.DISCORD_TOKEN, process.env.BOT_TOKEN].filter(Boolean);
        for (const secret of secrets) {
            if (s.includes(secret)) s = s.split(secret).join(TOKEN_DECOY);
        }
        return s.replace(TOKEN_RE, TOKEN_DECOY);
    }

    _isEphemeral(interaction) {
        try { return !!interaction.message?.flags?.has(MessageFlags.Ephemeral); }
        catch { return false; }
    }

    /** Escape triple-backticks so output can't break out of the code fence. */
    _sanitizeBlock(s) {
        return String(s ?? '').replace(/```/g, '`​`​`');
    }

    /**
     * Build the Components v2 message payload for a result. Returns
     * `{ components, flags }` with the IsComponentsV2 flag set (editing or
     * sending v2 components requires it); `open()` additionally ORs in
     * Ephemeral for the initial reply.
     */
    _render(interaction, state) {
        const { output, isError, ephemeral } = state;
        const header = isError ? this._t('error-header', interaction) : this._t('output-header', interaction);

        const safe = this._sanitizeBlock(output);
        let body = safe, truncated = false;
        if (body.length > MAX_OUTPUT) { body = body.slice(0, MAX_OUTPUT); truncated = true; }
        if (!body.trim()) body = this._t('empty', interaction);

        const container = new ContainerBuilder()
            .setAccentColor(isError ? 0xED4245 : 0x5865F2)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${header}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('```js\n' + body + '\n```'));

        if (truncated)
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                this._t('truncated', interaction, { shown: MAX_OUTPUT, total: safe.length })));

        container.addSeparatorComponents(new SeparatorBuilder());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('eval:edit').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.edit', interaction)).setEmoji('✏️'),
            new ButtonBuilder().setCustomId('eval:retry').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.retry', interaction)).setEmoji('🔁')
        );
        if (ephemeral)
            row.addComponents(new ButtonBuilder().setCustomId('eval:publish').setStyle(ButtonStyle.Success).setLabel(this._t('buttons.publish', interaction)).setEmoji('📢'));

        container.addActionRowComponents(row);
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    _remember(messageId, state) {
        this._sessions.delete(messageId);     // refresh FIFO position on update
        this._sessions.set(messageId, state);
        while (this._sessions.size > MAX_SESSIONS)
            this._sessions.delete(this._sessions.keys().next().value);
    }
};
