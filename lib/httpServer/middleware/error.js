const HTTPError = require('../httpError');
const InvalidOperationError = require('../../util/invalidOperationError');
const AuthorizationError = require('../../auth/authorizationError');

module.exports = (err, req, res, next) => {  // eslint-disable-line no-unused-vars                                    
    // Treat invalid operation errors as a bad request
    if (err instanceof InvalidOperationError)
        err = new HTTPError(400, err.message, err, null);
    // Treat authorization errors as a forbidden
    else if (err instanceof AuthorizationError)
        err = new HTTPError(403, err.message, err, null);
    // Treat all other errors as internal server error
    else if (!(err instanceof HTTPError)) {
        if (err.status) err = new HTTPError(err.status, err.message, err, null);
        else if (err.statusCode) err = new HTTPError(err.statusCode, err.message, err, null);
        else err = new HTTPError(500, null, err, null);
    }

    res.status(err.status);
    console.error(err.toPrint());

    if (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'test') res.json(err);
    else res.json({ status: err.status, message: err.message });
};