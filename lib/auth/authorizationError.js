const ExtendedError = require('../util/extendedError');

class AuthorizationError extends ExtendedError {
    constructor(...args) {
        super(...args);
    }
}

module.exports = AuthorizationError;