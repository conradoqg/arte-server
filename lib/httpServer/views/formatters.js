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
        url = '/buckets/' + artifact.bucket + '/artifacts';

        if (artifact.name) url += '/' + artifact.name;
        if (artifact.version) url += '/' + artifact.version;
        if (Object.keys(artifact.metadata).length) url += '?' + metadataObjectToList(artifact.metadata).replace(/,/g, '&');

        return url;
    },
    buildCLICommand: (req, artifact, os) => {
        let command = '';
        let metadataCommand = '';        
        let tokenCommand = '';

        if (os == 'linux' || os == 'macos') command += './arte get';
        else if (os == 'windows') command += 'arte.exe get';

        if (artifact.metadata) Object.keys(artifact.metadata).forEach(key => metadataCommand += `--metadata.${key} ${artifact.metadata[key]} `);

        const token = req.cookies ? req.cookies.authorization : null;
        if (token) tokenCommand = `-t '${token}'`;

        return `${command} -b ${artifact.bucket} -n ${artifact.name} -v ${artifact.version} ${metadataCommand} ${tokenCommand} --url ${req.protocol}://${req.headers.host}`;
    },
    dateToMomentAgo: (date) => {
        return moment(date).fromNow();
    },
    filesizeToHuman: filesize,
    metadataObjectToList
};