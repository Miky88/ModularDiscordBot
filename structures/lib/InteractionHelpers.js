const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

/**
 * Shared interaction/reply helpers used by the in-Discord GUIs
 * (SettingsUI, PermissionsUI, ModmanUI) and the command handler. These were
 * previously copy-pasted (and had drifted) across each of those files.
 */

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

module.exports = { safeUpdate, safeReply, safeError, truncate, errorPanel };
