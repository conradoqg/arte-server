const ExtendedError = require('../util/extendedError');

class AuthenticationError extends ExtendedError {
    constructor(...args) {
        super(...args);
    }
}

module.exports = AuthenticationError;
