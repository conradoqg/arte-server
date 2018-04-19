const webhookCaller = require('../util/webhookCaller');

class Webhook {
    constructor(metadataDB) {
        this.metadataDB = metadataDB;
    }

    post(webhook) {
        return this.metadataDB.createWebhook(webhook);
    }

    async call(bucket, event, artifact) {        
        const webhooks = await this.metadataDB.getWebhooks(bucket.name);

        webhooks.forEach(webhook => {
            const endpoint = webhook.endpoint;
            delete webhook['endpoint'];
            if (artifact.isSubset(webhook)) {
                // TODO: Send the pre-formatted CLI options and the URL to download the CLI itself
                webhookCaller(endpoint, event, artifact);
            }
        });
    }
}

module.exports = Webhook;