const ExtendableError = require('es6-error');

class ExtendedError extends ExtendableError {
    constructor(message, context, original) {
        super(message);
        if (context) this.context = context;
        if (original) this.original = { message: original.message, stack: original.stack };
    }

    toJSON() {
        const { message, type, stack, context, original } = this;
        return Object.assign({ message, type, stack, context, original }, this);
    }
}

module.exports = ExtendedError;