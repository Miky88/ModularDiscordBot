//const {logHook} = require('../modules/logging')
const {loading} = require('../../modules/Emojis')
exports.run = async (client, message, args) => {
  const {promisify} = require("util");
  const write = promisify(require("fs").writeFile);
  const m = await message.channel.send(loading + " Rebooting...");
  await write('./reboot.json', `{"id": "${m.id}", "channel": "${m.channel.id}"}`).catch(console.error);
  
  process.exit(1);
}

exports.help = {
  name: ':battery:reboot',
  info: 'Reboot the bot',
  usage: '',
}

exports.config = {
  aliases: ['restart'], // Array of aliases
  cooldown: 0, // Command cooldown
};
