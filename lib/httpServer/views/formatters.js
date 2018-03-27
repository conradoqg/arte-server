const filesize = require('filesize');
const moment = require('moment');

const metadataObjectToList = (object) => {
    const stringified = JSON.stringify(object);
    let transformed = stringified.replace(/:/g, '=');
    transformed = transformed.replace(/[{}"]/g, '');
    return transformed;
}

module.exports = {
    buildURL: (artifact) => {
        let url = '';
        url = '/buckets/' + artifact.bucket + '/artifacts';

        if (artifact.name) url += '/' + artifact.name;
        if (artifact.version) url += '/' + artifact.version;
        if (Object.keys(artifact.metadata).length) url += '?' + metadataObjectToList(artifact.metadata).replace(/,/g, '&');

        return url;
    },
    dateToMomentAgo: (date) => {
        return moment(date).fromNow();
    },
    filesizeToHuman: filesize,
    metadataObjectToList
};