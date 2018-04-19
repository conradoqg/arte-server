const filesize = require('filesize');
const moment = require('moment');

const metadataObjectToList = (object) => {
    const stringified = JSON.stringify(object);
    let transformed = stringified.replace(/:/g, '=');
    transformed = transformed.replace(/[{}"]/g, '');
    return transformed;
};

module.exports = {
    buildURL: (artifact) => {
        let url = '';
        url = '/api/buckets/' + artifact.bucket + '/artifacts';

        if (artifact.name) url += '/' + artifact.name;
        if (artifact.version) url += '/' + artifact.version;
        if (Object.keys(artifact.metadata).length) url += '?' + metadataObjectToList(artifact.metadata).replace(/,/g, '&');

        return url;
    },
    buildCLICommand: (artifact, os, req) => {
        let command = '';
        let metadataCommand = '';
        let tokenCommand = '';
        let urlCommand = '';

        if (os == 'linux' || os == 'macos') command += './arte get';
        else if (os == 'windows') command += 'arte.exe get';

        if (artifact.metadata) Object.keys(artifact.metadata).forEach(key => metadataCommand += ` --metadata.${key} ${artifact.metadata[key]}`);

        const token = req && req.cookies ? req.cookies.authorization : null;
        if (token) tokenCommand = ` -t '${token}'`;

        const url = req && req.protocol && req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
        if (url) urlCommand = ` --url ${url}`;

        return `${command} -b ${artifact.bucket} -n ${artifact.name} -v ${artifact.version}${metadataCommand}${tokenCommand}${urlCommand}`;
    },
    dateToMomentAgo: (date) => {
        return moment(date).fromNow();
    },
    filesizeToHuman: filesize,
    metadataObjectToList
};