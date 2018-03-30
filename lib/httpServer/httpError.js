const ExtendedError = require('../util/extendedError');
const statuses = require('statuses');

class HTTPError extends ExtendedError {
    constructor(status = 503, message, original, context) {
        if (!message) message = status + ' - ' + statuses[status];
        super(message, original, context);
        this.status = status;
    }

    toJSON() {
        const { status } = this;
        return Object.assign({ status }, super.toJSON());
    }
}

module.exports = HTTPError;
