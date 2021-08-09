/** @type {import('../modules/ArgParser').ArgType} */
module.exports = {
    name: 'channel',
    isEmpty(val, msg, arg) {
        return !`${val}`.trim()
    },
    validate(val, msg, arg) {
        const matches = val.match(/^(?:<#)?([0-9]+)>?$/)
        const client = msg.client
        if (matches) {
            try {
                const channel = client.channels.resolve(matches[1])
                if (!channel || (channel.type !== "text" && channel.type !== "news")) return false
                if (arg.oneOf && !arg.oneOf.includes(channel.id)) return false
                return true
            } catch (err) {
                return false
            }
        }
        if (!msg.guild) return false
        const search = val.toLowerCase()
        let channels = [...msg.guild.channels.values()].filter(channelFilterInexact(search))
        if (channels.length === 0) return false
        if (channels.length === 1) {
            if (arg.oneOf && !arg.oneOf.includes(channels[0].id)) return false
            return true
        }
        const exactChannels = channels.filter(channelFilterExact(search))
        if (exactChannels.length === 1) {
            if (arg.oneOf && !arg.oneOf.includes(exactChannels[0].id)) return false
            return true
        }
        if (exactChannels.length > 0) channels = exactChannels
        return !!channels.length
    },
    parse(val, msg, arg) {
        const matches = val.match(/^(?:<#)?([0-9]+)>?$/)
        if (matches) return msg._client.channels.find(c => c.id == matches[1]) || null
        if (!msg.guild) return null
        const search = val.toLowerCase()
        const channels = [...msg.guild.channels.values()].filter(channelFilterInexact(search))
        if (channels.length === 0) return null
        if (channels.length === 1) return channels[0]
        const inexactChannels = channels.filter(channelFilterExact(search))
        if (inexactChannels.length === 1) return inexactChannels[0]
        return null
    }
}

function channelFilterExact(search) {
    return chan => chan.type === "text" && chan.name.toLowerCase() === search
}

function channelFilterInexact(search) {
    return chan => chan.type === "text" && chan.name.toLowerCase().includes(search)
}
