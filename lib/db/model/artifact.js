const mongoose = require('mongoose');

const artifact = new mongoose.Schema({ bucket: 'string', name: 'string', version: 'string', normalizedVersion: 'string', path: 'string', fileSize: 'number', lastUpdate: 'date', metadata: 'mixed' });
artifact.index({ bucket: 1, name: 1 });
artifact.index({ bucket: 1, name: 1, normalizedVersion: 1 });
artifact.index({ bucket: 1, name: 1, normalizedVersion: -1 });

artifact.methods.project = function () {
    return {
        bucket: this.bucket,
        name: this.name,
        version: this.version,
        normalizedVersion: this.normalizedVersion,
        path: this.path,
        fileSize: this.fileSize,
        lastUpdate: this.lastUpdate,
        metadata: this.metadata
    };
};

module.exports = artifact;