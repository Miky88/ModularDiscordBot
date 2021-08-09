/** @type {import("../utils/argparser").ArgType} */
module.exports = {
  name: 'message',
  isEmpty(val, msg, arg) {
    return !`${val}`.trim()
  },
  async validate(val, msg, arg) {
    if (!/^[0-9]+$/.test(val)) return false
    return Boolean(await msg.channel.messages.fetch(val).catch(() => null))
  },
  parse(val, msg, arg) {
    return msg.channel.messages.fetch(val)
  }
}
