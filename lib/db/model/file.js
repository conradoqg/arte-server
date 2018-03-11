const mongoose = require('mongoose');

const file = new mongoose.Schema({ bucket: 'string', name: 'string', version: 'string', normalizedVersion: 'string', path: 'string', fileSize: 'number', lastUpdate: 'date', metadata: 'mixed' });
file.index({ bucket: 1, name: 1 });
file.index({ bucket: 1, name: 1, normalizedVersion: 1 });
file.index({ bucket: 1, name: 1, normalizedVersion: -1 });

file.methods.project = function () {
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

module.exports = file;