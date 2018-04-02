const mongoose = require('mongoose');

const artifact = new mongoose.Schema({ bucket: 'string', name: 'string', version: 'string', normalizedVersion: 'string', path: 'string', fileSize: 'number', lastUpdate: 'date', metadata: 'mixed' });
artifact.index({ bucket: 1, name: 1 });
artifact.index({ bucket: 1, name: 1, normalizedVersion: 1 });
artifact.index({ bucket: 1, name: 1, normalizedVersion: -1 });

artifact.methods.project = function () {
    return {
        bucket: this.bucket,
        name: this.name,
        version: this.version,
        normalizedVersion: this.normalizedVersion,
        path: this.path,
        fileSize: this.fileSize,
        lastUpdate: this.lastUpdate,
        metadata: this.metadata
    };
};

artifact.methods.isSubset = function (superset) {
    return compareObject(
        {
            bucket: this.bucket,
            artifact: this.name,
            version: this.version,
            normalizedVersion: this.normalizedVersion,
            metadata: this.metadata
        }, {
            bucket: superset.bucket,
            artifact: superset.artifact,
            version: superset.version,
            normalizedVersion: superset.normalizedVersion,
            metadata: superset.metadata
        });
};

const compareObject = (object, superset) => {
    let result = true;
    if (typeof (object) == 'undefined') return false;

    for (const [key, value] of Object.entries(superset)) {
        if (typeof (value) == 'undefined') continue;
        else if (typeof (value) == 'object') result = compareObject(object[key], value);
        else result = compareProperty(object[key], value);

        if (!result) return false;
    }

    return result;
};

const compareProperty = (raw, filter) => {    
    if (typeof (raw) == 'undefined') return false;
    else if (containsRegexp(filter)) return storedRegexToRegex(filter, 'gi').test(raw);
    else if (containsWildcard(filter)) return globStringToRegex(filter, 'gi').test(raw);
    else return raw == filter;
};

const containsRegexp = (content) => {
    return (content.startsWith('/') && content.endsWith('/'));
};

const containsWildcard = (content) => {
    return (content.includes('*') || content.includes('?'));
};

const storedRegexToRegex = (str, options) => {
    return (new RegExp(str.replace(/(^\/+|\/+$)/mg, ''), options));
};

const globStringToRegex = (str, options) => {
    return new RegExp('^' + preg_quote(str).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$', options);
};

const preg_quote = (str, delimiter) => {
    // http://kevin.vanzonneveld.net
    // +   original by: booeyOH
    // +   improved by: Ates Goral (http://magnetiq.com)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: preg_quote("$40");
    // *     returns 1: '\$40'
    // *     example 2: preg_quote("*RRRING* Hello?");
    // *     returns 2: '\*RRRING\* Hello\?'
    // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
    // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
};

module.exports = artifact;