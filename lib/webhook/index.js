const webhookCaller = require('../util/webhookCaller');
const formatters = require('../../lib/httpServer/views/formatters');

class Webhook {
    constructor(metadataDB) {
        this.metadataDB = metadataDB;
        this.req = null;
    }

    post(webhook) {
        return this.metadataDB.createWebhook(webhook);
    }

    setReq(req) {
        this.req = req;
    }

    async call(req, bucket, event, artifact) {
        const webhooks = await this.metadataDB.getWebhooks(bucket.name);

        webhooks.forEach(webhook => {
            const endpoint = webhook.endpoint;
            delete webhook['endpoint'];
            if (artifact.isSubset(webhook)) {
                let links = {
                    getCLIWindows: {
                        href: formatters.buildCLICommand(artifact, 'windows', req)
                    },
                    getCLILinux: {
                        href: formatters.buildCLICommand(artifact, 'linux', req)
                    },
                    getCLIMacos: {
                        href: formatters.buildCLICommand(artifact, 'macos', req)
                    }
                };

                webhookCaller(endpoint, event, artifact, links);
            }
        });
    }
}

module.exports = Webhook;