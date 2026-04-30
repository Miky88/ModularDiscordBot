const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require('discord.js');

/**
 * Interactive in-Discord GUI for managing bot modules.
 * Custom-id convention: `modman:<screen>[:<arg>...]`. State that needs to
 * survive across interactions piggybacks on customIds; Discord components
 * are stateless. All user-facing strings flow through the locale system —
 * see modules/System/locales/<lang>.yaml under `commands.modman.ui.*`.
 */
module.exports = class ModmanUI {
    /**
     * @param {import('../System.js')} systemModule
     */
    constructor(systemModule) {
        this.module = systemModule;
        this.client = systemModule.client;
    }

    /** Localize a UI string under `commands.modman.ui.<key>` for this interaction's locale. */
    _t(key, interaction, vars) {
        return this.module.t(`commands.modman.ui.${key}`, interaction, vars);
    }

    /** Slash command entry — open the home panel ephemerally. */
    async open(interaction) {
        await interaction.reply({ ...this._home(interaction), flags: MessageFlags.Ephemeral });
    }

    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async handle(interaction) {
        const id = interaction.customId;
        if (!id?.startsWith('modman:')) return false;
        const [, screen, ...args] = id.split(':');

        try {
            switch (screen) {
                case 'home':            return this._update(interaction, this._home(interaction));
                case 'close':           return interaction.update({ content: this._t('errors.closed', interaction), embeds: [], components: [] });
                case 'pick':            return this._update(interaction, this._detail(interaction, interaction.values[0]));
                case 'detail':          return this._update(interaction, this._detail(interaction, args[0]));
                case 'reload':          return this._action(interaction, args[0], 'reload');
                case 'toggle':          return this._action(interaction, args[0], 'toggle');
                case 'unload':          return this._unloadFlow(interaction, args[0]);
                case 'unload_force':    return this._action(interaction, args[0], 'unload_force');
                case 'load_btn':        return this._loadModal(interaction);
                case 'load_modal':      return this._loadFromModal(interaction);
                case 'reload_all':      return this._reloadAll(interaction);
            }
        } catch (err) {
            this.client.errorHandler?.capture(err, { source: 'ModmanUI', userId: interaction.user?.id });
            await this._safeError(interaction, err.message);
        }
        return true;
    }

    // ───── HOME ─────

    _home(interaction) {
        const { loaded, available, failed } = this.client.moduleManager.list();
        const allNames = [...new Set([...loaded, ...available, ...failed.map(f => f.name)])].sort();

        const lines = allNames.map(name => `${this._badge(name)} \`${name}\``);
        const failedSummary = failed.length
            ? `\n\n${this._t('home.failed-summary', interaction)}\n${failed.map(f => `⚠ \`${f.name}\` — ${this._truncate(f.error, 80)}`).join('\n')}`
            : '';

        const embed = new EmbedBuilder()
            .setTitle(this._t('home.title', interaction))
            .setDescription(this._t('home.description', interaction) + failedSummary)
            .addFields({ name: this._t('home.all-modules', interaction), value: lines.join('\n') || this._t('home.none', interaction) })
            .setFooter({ text: this._t('home.footer', interaction, { loaded: loaded.length, available: available.length, failed: failed.length }) });

        const components = [];
        if (allNames.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('modman:pick')
                    .setPlaceholder(this._t('home.pick-placeholder', interaction))
                    .addOptions(allNames.slice(0, 25).map(n => ({
                        label: n,
                        description: this._statusText(interaction, n),
                        value: n
                    })))
            ));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('modman:load_btn').setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.load-module', interaction)).setEmoji('➕'),
            new ButtonBuilder().setCustomId('modman:reload_all').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.reload-all', interaction)).setEmoji('🔁'),
            new ButtonBuilder().setCustomId('modman:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.refresh', interaction)).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('modman:close').setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.close', interaction)).setEmoji('❌')
        ));

        return { content: '', embeds: [embed], components };
    }

    _badge(name) {
        const mm = this.client.moduleManager;
        if (!mm.isLoaded(name) && !mm.isOnDisk(name)) return '❓';
        if (!mm.isLoaded(name)) {
            const failed = mm.list().failed.some(f => f.name === name);
            return failed ? '⚠' : '⛔';
        }
        return mm.isEnabled(name) ? '✅' : '🟡';
    }

    _statusText(interaction, name) {
        const mm = this.client.moduleManager;
        if (!mm.isLoaded(name)) {
            const failed = mm.list().failed.some(f => f.name === name);
            return this._t(failed ? 'status.load-failed' : 'status.not-loaded', interaction);
        }
        return this._t(mm.isEnabled(name) ? 'status.enabled' : 'status.disabled', interaction);
    }

    // ───── DETAIL ─────

    _detail(interaction, name) {
        const mm = this.client.moduleManager;
        const r = mm.info(name);
        if (!r.ok) return this._errorPanel(interaction, this._t('detail.not-found', interaction, { name, error: r.error }));
        const i = r.value;

        const none = this._t('detail.none', interaction);
        const embed = new EmbedBuilder()
            .setTitle(`🧩 ${name}`)
            .setDescription(i.info || this._t('detail.no-description', interaction))
            .addFields(
                { name: this._t('detail.status', interaction),       value: this._statusText(interaction, name), inline: true },
                { name: this._t('detail.version', interaction),      value: i.version || none, inline: true },
                { name: this._t('detail.events', interaction),       value: i.events?.length       ? i.events.map(e => `\`${e}\``).join(', ') : none, inline: false },
                { name: this._t('detail.dependencies', interaction), value: i.dependencies?.length ? i.dependencies.map(d => `\`${d}\``).join(', ') : none, inline: true },
                { name: this._t('detail.dependents', interaction),   value: i.dependents?.length   ? i.dependents.map(d => `\`${d}\``).join(', ') : none, inline: true },
                { name: this._t('detail.commands', interaction),     value: i.commands?.length     ? i.commands.map(c => `\`/${c}\``).join(', ') : none, inline: false }
            );
        if (i.lastError) embed.addFields({ name: this._t('detail.last-error', interaction), value: '```' + this._truncate(i.lastError, 1000) + '```' });

        const components = [];
        const buttons1 = [];
        if (i.loaded) {
            buttons1.push(
                new ButtonBuilder().setCustomId(`modman:reload:${name}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.reload', interaction)).setEmoji('🔁'),
                new ButtonBuilder().setCustomId(`modman:toggle:${name}`).setStyle(i.enabled ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setLabel(this._t(i.enabled ? 'buttons.disable' : 'buttons.enable', interaction)).setEmoji(i.enabled ? '🟡' : '✅'),
                new ButtonBuilder().setCustomId(`modman:unload:${name}`).setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.unload', interaction)).setEmoji('🗑️')
            );
        } else if (mm.isOnDisk(name)) {
            buttons1.push(new ButtonBuilder().setCustomId(`modman:reload:${name}`).setStyle(ButtonStyle.Primary).setLabel(this._t('buttons.load', interaction)).setEmoji('➕'));
        }
        buttons1.push(new ButtonBuilder().setCustomId('modman:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️'));

        components.push(new ActionRowBuilder().addComponents(...buttons1));
        return { embeds: [embed], components };
    }

    // ───── ACTIONS ─────

    async _action(interaction, name, kind) {
        const mm = this.client.moduleManager;
        let result;
        switch (kind) {
            case 'reload':
                result = mm.isLoaded(name) ? await mm.reload(name) : await mm.load(name);
                break;
            case 'toggle':
                result = mm.isEnabled(name) ? await mm.disable(name) : await mm.enable(name);
                break;
            case 'unload_force':
                result = await mm.unload(name, { force: true });
                break;
        }
        if (!result?.ok)
            return this._update(interaction, this._errorPanel(interaction, this._t('errors.action-failed', interaction, {
                action: kind, name, code: result?.code || 'ERROR', error: result?.error || 'unknown'
            })));
        return this._update(interaction, this._detail(interaction, name));
    }

    async _unloadFlow(interaction, name) {
        const mm = this.client.moduleManager;
        const r = await mm.unload(name);
        if (r.ok) return this._update(interaction, this._home(interaction));

        if (r.code === 'DEPENDENCY_LOCKED') {
            const embed = new EmbedBuilder()
                .setTitle(this._t('unload.title', interaction, { name }))
                .setDescription(this._t('unload.cascade-warning', interaction, { deps: r.error }));
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`modman:unload_force:${name}`).setStyle(ButtonStyle.Danger).setLabel(this._t('buttons.force-unload', interaction)).setEmoji('💥'),
                new ButtonBuilder().setCustomId(`modman:detail:${name}`).setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.cancel', interaction)).setEmoji('⬅️')
            );
            return this._update(interaction, { embeds: [embed], components: [buttons] });
        }
        return this._update(interaction, this._errorPanel(interaction, this._t('unload.failed', interaction, { code: r.code, error: r.error })));
    }

    async _reloadAll(interaction) {
        const mm = this.client.moduleManager;
        const loaded = mm.list().loaded;
        const results = [];
        for (const name of loaded) {
            const r = await mm.reload(name);
            results.push(`${r.ok ? '✅' : '❌'} \`${name}\`${r.ok ? '' : ` — ${r.error}`}`);
        }
        const embed = new EmbedBuilder()
            .setTitle(this._t('reload-all.title', interaction))
            .setDescription(results.join('\n') || this._t('reload-all.none', interaction));
        return this._update(interaction, {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('modman:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
            )]
        });
    }

    async _loadModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('modman:load_modal')
            .setTitle(this._t('load-modal.title', interaction));
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('name').setLabel(this._t('load-modal.name-label', interaction))
                    .setPlaceholder(this._t('load-modal.name-placeholder', interaction)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64)
            )
        );
        await interaction.showModal(modal);
    }

    async _loadFromModal(interaction) {
        const name = interaction.fields.getTextInputValue('name').trim();
        const r = await this.client.moduleManager.load(name);
        if (!r.ok)
            return this._update(interaction, this._errorPanel(interaction, this._t('errors.load-failed', interaction, { code: r.code, error: r.error })));
        return this._update(interaction, this._detail(interaction, name));
    }

    // ───── helpers ─────

    _errorPanel(interaction, message) {
        const embed = new EmbedBuilder()
            .setTitle(this._t('home.title', interaction))
            .setDescription(`:x: ${message}`)
            .setColor(0xE74C3C);
        return {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('modman:home').setStyle(ButtonStyle.Secondary).setLabel(this._t('buttons.back', interaction)).setEmoji('⬅️')
            )]
        };
    }

    async _update(interaction, payload) {
        if (interaction.replied || interaction.deferred)
            return interaction.editReply(payload);
        return interaction.update(payload);
    }

    async _safeError(interaction, message) {
        const payload = { content: `:x: ${message}`, embeds: [], components: [], flags: MessageFlags.Ephemeral };
        try {
            if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
            return interaction.reply(payload);
        } catch { /* swallow */ }
    }

    _truncate(s, max) {
        if (s == null) return '';
        s = String(s);
        return s.length <= max ? s : s.slice(0, max - 8) + '…[…]';
    }
};
