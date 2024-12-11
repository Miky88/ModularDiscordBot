module.exports = class Utils {
    parseUser(user) {
        return `${user.toString()} (\`${user.id}\`)`;
    }
}
