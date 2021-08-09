/** @type {import('../modules/ArgParser').ArgType} */
module.exports = {
    name: 'int',
    isEmpty() {
        return false
    },
    validate(val, msg, arg) {
        let valid = !isNaN(parseInt(val));
        if (!valid)
            return valid;

        if (arg.min != null && arg.min != undefined)
            valid = valid && parseInt(val) >= arg.min;
        if (arg.max != null && arg.max != undefined)
            valid = valid && parseInt(val) <= arg.max;

        let id = arg.min != null && arg.min != undefined ? "ARG_OOB_INT_MIN" : "ARG_OOB_INT_MAX";
        if (arg.max != null && arg.max != undefined && arg.min != null && arg.min != undefined)
            id = "ARG_OOB_INT";

        if (!valid)
            return {
                error: true,
                id
            }

        return valid;
    },
    parse(val, msg, arg) {
        return parseInt(val);
    }
}
