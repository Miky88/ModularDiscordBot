/** @type {import('../utils/argparser').ArgType} */
module.exports = {
  name: 'role',
  isEmpty(val, msg, arg) {
    return !`${val}`.trim()
  },
  validate(val, msg, arg) {
    return !!msg.guild.strToRole(val)
  },
  parse(val, msg, arg) {
    return msg.guild.strToRole(val)
  }
}
