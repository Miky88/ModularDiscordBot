const { inspect } = require("util");
const { MessageEmbed } = require("discord.js");

exports.run = async (client, message, args) => {
  const content = args.join(' ').replace(/client\.token/gmi, '\'mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0\'');

  try {
    let result = await eval(content);
    if (typeof result !== 'string') {
      result = inspect(result, {
        depth: 0,
      });
    }

    if (result.includes(client.token)) result = `${result}`.split(client.token).join('mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0');

    if (result.length > 2048) {
      console.log(result);
      result = 'Too long to be printed (content got console logged)';
      const embed = new MessageEmbed()
        .setTitle('Eval - Output')
        .setDescription(`\`\`\`js\n${result}\n\`\`\``)
        .setColor('RANDOM')
      return message.channel.send(embed);
    }

    const embed = new MessageEmbed()
      .setTitle('Eval - Output')
      .setDescription(`\`\`\`js\n${result}\n\`\`\``)
      .setColor('RANDOM')
    message.channel.send(embed);

  } catch (err) {
    console.error(err);

    const error = err.toString().replace(client.token, 'mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0');
    const embed = new MessageEmbed()
      .setTitle('Eval - Error')
      .setDescription(`\`\`\`js\n${error}\n\`\`\``)
      .setColor('ff1c1c')
    message.channel.send(embed);
  }
};

exports.help = {
  name: ":computer:eval",
  info: "Evaluates albitrary JavaScript",
  usage: "[code]"
};

exports.config = {
  aliases: ["ev", "js"], // Array of aliases
  cooldown: 3 // Command cooldown
};