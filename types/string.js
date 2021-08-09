/** @type {import('../modules/ArgParser').ArgType} */
module.exports = {
    name: 'string',
    isEmpty(val, msg, arg) {
        return !`${val}`.trim()
    },
    validate(val, msg, arg) {
        if (val && ((arg.min != undefined && arg.min != null) || (arg.max != undefined && arg.max != null))) {
            let valid = true;

            if (arg.min != null && arg.min != undefined)
                valid = valid && val.length >= arg.min;
            if (arg.max != null && arg.max != undefined)
                valid = valid && val.length <= arg.max;

            let id = arg.min != null && arg.min != undefined ? "ARG_OOB_LEN_MIN" : "ARG_OOB_LEN_MAX";
            if (arg.max != null && arg.max != undefined && arg.min != null && arg.min != undefined)
                id = "ARG_OOB_LEN";

            if (!valid)
                return {
                    error: true,
                    id
                }
        }

        if (arg.oneOf != undefined && !arg.oneOf.includes(val)) {
            return {
                error: true,
                id: "ARG_ONEOF_NOT_IN_LIST"
            }
        }

        return true
    },
    parse(val, msg, arg) {
        return val
    }
}
