Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)];
};
Array.prototype.remove = function (value) {
    let i = this.indexOf(value);
    (i > -1) && this.splice(i, 1);
    return this;
};
String.prototype.toProperCase = function () {
    return this.replace(/([^\W_]+[^\s-]*) */g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};