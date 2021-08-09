/** @type {import('../modules/ArgParser').ArgType} */
module.exports = {
    name: 'user',
    isEmpty(val, msg, arg) {
        return !`${val}`.trim()
    },
    validate(val, msg, arg) {
        const matches = val.match(/^(?:<@!?)?([0-9]+)>?$/)
        if (!msg.guild) return false
        if (matches) {
            try {
                const member = msg.guild.members.resolve(matches[1])
                if (!member) return false
                if (arg.oneOf && !arg.oneOf.includes(member.id)) return false
                return true
            } catch (err) {
                return false
            }
        }
        const search = val.toLowerCase()
        let members = [...msg.guild.members.cache.values()].filter(memberFilterInexact(search))
        if (members.length === 0) return false
        if (members.length === 1) {
            if (arg.oneOf && !arg.oneOf.includes(members[0].id)) return false
            return true
        }
        const exactMembers = members.filter(memberFilterExact(search))
        if (exactMembers.length === 1) {
            if (arg.oneOf && !arg.oneOf.includes(exactMembers[0].id)) return false
            return true
        }
        if (exactMembers.length > 0) members = exactMembers
        return !!members.length
    },
    parse(val, msg, arg) {
        const matches = val.match(/^(?:<@!?)?([0-9]+)>?$/)
        if (!msg.guild) return null
        if (matches) return msg.guild.members.resolve(matches[1]).user
        const search = val.toLowerCase()
        const members = [...msg.guild.members.cache.values()].filter(memberFilterInexact(search))
        if (members.length === 0) return null
        if (members.length === 1) return members[0].user
        const exactMembers = members.filter(memberFilterExact(search))
        if (exactMembers.length === 1) return exactMembers[0].user
        return members[0];
    }
}

function memberFilterExact(search) {
    return member => member.user.tag.toLowerCase() === search.toLowerCase() || member.displayName.toLowerCase() === search.toLowerCase()
}

function memberFilterInexact(search) {
    return member => member.user.tag.toLowerCase().includes(search.toLowerCase()) || member.displayName.toLowerCase().includes(search.toLowerCase())
}
