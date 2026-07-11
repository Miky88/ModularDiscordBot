const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags
} = require('discord.js');

/**
 * Shared interaction/reply helpers used by the in-Discord GUIs
 * (SettingsUI, CommandPermissionsView, ModmanUI) and the command handler. These
 * were previously copy-pasted (and had drifted) across each of those files.
 */

/** Hard cap on options in a Discord string-select menu. */
const SELECT_PAGE_SIZE = 25;

/**
 * Edit a component interaction in place: `editReply` if it's already been
 * acknowledged (replied/deferred), otherwise `update`.
 * @param {import('discord.js').Interaction} interaction
 * @param {string | import('discord.js').InteractionUpdateOptions} payload
 */
function safeUpdate(interaction, payload) {
    if (interaction.replied || interaction.deferred) return interaction.editReply(payload);
    return interaction.update(payload);
}

/**
 * Best-effort reply that won't throw if the interaction was already
 * replied/deferred or has expired. `followUp` when already acknowledged,
 * else `reply`. Send failures are passed to `onError` (if given) and
 * otherwise swallowed.
 * @param {import('discord.js').Interaction} interaction
 * @param {string | import('discord.js').InteractionReplyOptions} payload
 * @param {(err: unknown) => void} [onError]
 */
async function safeReply(interaction, payload, onError) {
    try {
        if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
        return await interaction.reply(payload);
    } catch (err) {
        onError?.(err);
    }
}

/**
 * Ephemeral `:x: <message>` error reply that also clears any existing
 * embeds/components. Swallows send failures (best-effort).
 * @param {import('discord.js').Interaction} interaction
 * @param {string} message
 * @param {(err: unknown) => void} [onError]
 */
function safeError(interaction, message, onError) {
    return safeReply(interaction, {
        content: `:x: ${message}`, embeds: [], components: [], flags: MessageFlags.Ephemeral
    }, onError);
}

/**
 * Truncate `s` to at most `max` characters, appending `ellipsis` (which is
 * counted within `max`). Nullish input becomes ''.
 * @param {*} s
 * @param {number} max
 * @param {string} [ellipsis]
 */
function truncate(s, max, ellipsis = '…') {
    if (s == null) return '';
    s = String(s);
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - ellipsis.length)) + ellipsis;
}

/**
 * Backslash-escape Discord markdown so arbitrary content (setting values, user
 * text) renders literally when interpolated into message text — otherwise a
 * stray `` ` ``, `*`, `_`, `~` or `|` corrupts the surrounding layout. Newlines
 * are collapsed to spaces so the value stays on one line in compact UI cells.
 *
 * NOTE: backslash escapes do NOT work inside a code span (`` `…` ``) — Discord
 * treats everything there literally including the backslash. Use this for
 * plain-text interpolation, not inside backticks.
 * @param {*} s
 * @returns {string}
 */
function escapeMarkdown(s) {
    return String(s ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/([\\`*_~|])/g, '\\$1');
}

/**
 * Build a one-button "back to home" error panel payload. The title and button
 * label are passed in already-localized; `homeId` is the per-GUI customId
 * (e.g. `settings:home`).
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} opts.title
 * @param {string} opts.homeId
 * @param {string} opts.backLabel
 */
function errorPanel({ message, title, homeId, backLabel }) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`:x: ${message}`)
        .setColor(0xE74C3C);
    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(homeId).setStyle(ButtonStyle.Secondary).setLabel(backLabel).setEmoji('⬅️')
        )]
    };
}

/**
 * Pure pagination math. Clamps `page` into `[0, pageCount)` and returns that
 * page's slice. Use this when you render the page yourself (e.g. as Components-v2
 * Sections) and just need the slice + a `navRow`.
 * @param {Array} items Full list (pre-sorted).
 * @param {number} [page] Requested 0-based page.
 * @param {number} [pageSize=25]
 * @returns {{ pageItems: any[], page: number, pageCount: number }}
 */
function paginate(items, page = 0, pageSize = SELECT_PAGE_SIZE) {
    const list = Array.isArray(items) ? items : [];
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    const current = Math.min(Math.max(0, Number(page) || 0), pageCount - 1);
    return { pageItems: list.slice(current * pageSize, current * pageSize + pageSize), page: current, pageCount };
}

/**
 * A prev/next nav action row (two label-less ◀️/▶️ buttons, disabled at the
 * bounds), or `null` when there's only one page. `navFor(page)` builds the
 * custom-id for a target page — letting the page index sit anywhere in the id
 * (e.g. screens paginated on two axes).
 * @param {(page: number) => string} navFor
 * @param {number} page Current 0-based page.
 * @param {number} pageCount
 * @returns {import('discord.js').ActionRowBuilder | null}
 */
function navRow(navFor, page, pageCount) {
    if (pageCount <= 1) return null;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(navFor(page - 1)).setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(page <= 0),
        new ButtonBuilder().setCustomId(navFor(page + 1)).setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(page >= pageCount - 1)
    );
}

/**
 * Build a paginated string-select with prev/next navigation. Returns the action
 * row(s) ready to drop into a component array (or a Components-v2 container): the
 * select row, plus a nav row of two emoji buttons only when the items overflow a
 * single page (≤25 options).
 *
 * The nav buttons re-enter the *same* screen at an adjacent page. Pass either
 * `navIdBase` (page appended as `:<page>`) or, when the page index isn't the last
 * segment, a `navId(page)` builder. `pageItems` is the clamped page's slice —
 * build any accompanying text list from it so list and dropdown stay in lock-step.
 *
 * @param {object} opts
 * @param {Array} opts.items
 * @param {number} opts.page
 * @param {string} opts.selectId
 * @param {string} [opts.navIdBase]
 * @param {(page: number) => string} [opts.navId]
 * @param {string} opts.placeholder
 * @param {(item: any) => object} opts.toOption
 * @param {number} [opts.pageSize=25]
 * @returns {{ rows: import('discord.js').ActionRowBuilder[], page: number, pageCount: number, pageItems: any[] }}
 */
function pagedSelectRows({ items, page = 0, selectId, navIdBase, navId, placeholder, toOption, pageSize = SELECT_PAGE_SIZE }) {
    const { pageItems, page: current, pageCount } = paginate(items, page, pageSize);
    const navFor = navId || (p => `${navIdBase}:${p}`);

    const rows = [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(selectId)
            .setPlaceholder(placeholder)
            .addOptions(pageItems.map(toOption))
    )];
    const nav = navRow(navFor, current, pageCount);
    if (nav) rows.push(nav);

    return { rows, page: current, pageCount, pageItems };
}

/**
 * A Components-v2 error payload: a red accent container with a `:x: <message>`
 * text display and (optionally) a single Back button. The returned object
 * carries the `IsComponentsV2` flag, so it can be handed straight to
 * `reply`/`update`/`editReply` for a v2 message (where embeds aren't allowed).
 * This is the v2 counterpart of {@link errorPanel} (which is embed-based, kept
 * for v1 consumers like ModmanUI).
 * @param {object} opts
 * @param {string} opts.message
 * @param {string} [opts.backId]    Custom-id for the Back button (omit for no button).
 * @param {string} [opts.backLabel]
 * @param {number} [opts.accentColor=0xE74C3C]
 */
function errorContainer({ message, backId, backLabel, accentColor = 0xE74C3C }) {
    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`:x: ${message}`));
    if (backId) container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(backId).setStyle(ButtonStyle.Secondary).setLabel(backLabel).setEmoji('⬅️')
    ));
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

module.exports = { safeUpdate, safeReply, safeError, truncate, escapeMarkdown, errorPanel, errorContainer, paginate, navRow, pagedSelectRows, SELECT_PAGE_SIZE };
