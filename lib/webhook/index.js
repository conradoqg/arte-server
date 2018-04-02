const webhookCaller = require('../util/webhookCaller');

class Webhook {
    constructor(metadataDB) {
        this.metadataDB = metadataDB;
    }

    post(webhook) {
        return this.metadataDB.createWebhook(webhook);
    }

    async call(bucket, artifact) {
        const webhooks = await this.metadataDB.getWebhooks(bucket.name);

        webhooks.forEach(webhook => {
            const endpoint = webhook.endpoint;
            delete webhook['endpoint'];
            if (artifact.isSubset(webhook)) {
                webhookCaller(endpoint, artifact);
            }
        });
    }
}

module.exports = Webhook;