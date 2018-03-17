const formidable = require('formidable');
const HTTPError = require('../httpError');

module.exports = (req, res, next) => {    
    const form = new formidable.IncomingForm();

    form.parse(req);

    form.on('field', function (name, value) {
        if (!req.fields) req.fields = {};
        req.fields[name] = value;
    });

    form.on('file', function (name, file) {
        req.file = file;
    });

    form.on('end', next);

    form.on('error', function (err) {
        next(new HTTPError(400, err.message, null, err));
    });
};