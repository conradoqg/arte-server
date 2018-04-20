const mongoose = require('mongoose');

const webhook = new mongoose.Schema({ bucket: 'string', artifact: 'string', version: 'string', normalizedVersion: 'string', metadata: 'mixed', endpoint: 'string' }, { timestamps: true });

webhook.methods.project = function () {
    return {
        id: this._id,
        bucket: this.bucket,
        artifact: this.artifact,
        version: this.version,
        normalizedVersion: this.normalizedVersion,
        metadata: this.metadata,
        endpoint: this.endpoint
    };
};

module.exports = webhook;