const request = require("superagent")
const BaseCommand = require('../../modules/BaseCommand')

module.exports = class DocsCommand extends BaseCommand {
    constructor() {
        super({
            name: ":notebook_with_decorative_cover:docs",
            info: "Search on Discord.js Docs",
            usage: "[query] [--master]",
            cooldown: 3,
            args: [
                {
                    name: "query",
                    type: "string"
                }
            ]
        })
    }

    async run(client, message, args) {
        let queryString = args.query
        let project = message.data.flags.master ? "master" : "stable"
        let res = await request.get(`https://djsdocs.sorta.moe/v2/embed?src=${project}&q=${queryString}`)
        if (!res.body || res.body == null) return message.reply("No match")
        message.channel.send({ embeds: [res.body] })
    }
}