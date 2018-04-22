const AuthorizationError = require('../auth/authorizationError');
const rewire = require('rewire');
const expressNodeMetrics = rewire('express-node-metrics');
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
        metrics = expressNodeMetrics.metrics;
        return expressNodeMetrics.middleware;
    }
}

module.exports = Metric;