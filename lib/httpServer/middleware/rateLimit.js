const RateLimit = require('express-rate-limit');

const createLimiterHandler = (windowMs, message) => {
    return (req, res, /*next*/) => {
        if (req.accepts('html')) {
            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
            res.status(429).send(message);
        } else if (req.accepts('json')) {
            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
            res.status(429).json({
                status: 429,
                message: message
            });
        }
    };
};

const limiterLogger = (req) => {
    console.warn(`Request limit reached for user ${req.user ? req.user.name : 'unknown'} on path ${req.path}`);
};

module.exports = new RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    delayMs: 0, // disable delaying - full speed until the max limit is reached
    message: 'Too many requests, please try again after a 15 minutes',
    handler: createLimiterHandler(15 * 60 * 1000, 'Too many requests, please try again after a 15 minutes'),
    onLimitReached: limiterLogger
});
