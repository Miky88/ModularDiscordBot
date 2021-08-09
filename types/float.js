/** @type {import('../modules/ArgParser').ArgType} */
module.exports = {
    name: 'float',
    isEmpty(val) {
        return !val.trim();
    },
    validate(val, msg, arg) {
        val = val.replace(/,/, ".");
        let valid = !isNaN(parseFloat(val));
        if (!valid)
            return valid;

        if (arg.min != null && arg.min != undefined)
            valid = valid && parseFloat(val) >= arg.min;
        if (arg.max != null && arg.max != undefined)
            valid = valid && parseFloat(val) <= arg.max;

        let id = arg.min != null && arg.min != undefined ? "ARG_OOB_FLOAT_MIN" : "ARG_OOB_FLOAT_MAX";
        if (arg.max != null && arg.max != undefined && arg.min != null && arg.min != undefined)
            id = "ARG_OOB_FLOAT";

        if (!valid)
            return {
                error: true,
                id
            }

        return valid;
    },
    parse(val, msg, arg) {
        return parseFloat(val.replace(/,/, "."));
    }
}
