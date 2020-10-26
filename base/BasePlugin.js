class BasePlugin {
    constructor({
        name = null,
        info = "No description provided.",
        enabled = false,
        event = "ready"
    }) {
        this.conf = { enabled, event };
        this.about = { name, info };
    }
}
module.exports = BasePlugin;