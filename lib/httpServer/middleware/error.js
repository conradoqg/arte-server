const HTTPError = require('../httpError');
const InvalidOperationError = require('../../util/invalidOperationError');

module.exports = (err, req, res, next) => {  // eslint-disable-line no-unused-vars                                    
    // Treat invalid operation errors as a bad request
    if (err instanceof InvalidOperationError)
        err = new HTTPError(400, err.message, null, err);
    // Treat all other errors as internal server error
    else if (!(err instanceof HTTPError)) {
        if (err.status) err = new HTTPError(err.status, err.message, null, err);
        else if (err.statusCode) err = new HTTPError(err.statusCode, err.message, null, err);
        else err = new HTTPError(500, null, null, err);
    }

    res.status(err.status);
    console.error(err.toPrint());

    if (process.env.NODE_ENV == 'development') res.json(err);
    else res.json({ status: err.status, message: err.message });
};