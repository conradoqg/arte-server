const AuthorizationError = require('../auth/authorizationError');
let metrics = null;

class Metric {
    constructor(authService) {
        this.authService = authService;
    }

    async getMetrics(req, reset) {
        if (!await this.authService.checkCredential(req.credential, 'admin:metrics:read')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to get admin metrics`);

        return JSON.parse(metrics ? metrics.getAll(reset) : {});
    }

    createMetricMiddleware() {
        const expressNodeMetrics = require('express-node-metrics');
        metrics = expressNodeMetrics.metrics;
        return expressNodeMetrics.middleware;
    }
}

module.exports = Metric;