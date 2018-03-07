const ExtendedError = require('../util/extendedError');

class InvalidOperationError extends ExtendedError {
    constructor(...args) {
        super(...args);
    }
}

module.exports = InvalidOperationError;