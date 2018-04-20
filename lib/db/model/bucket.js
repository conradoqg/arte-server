const mongoose = require('mongoose');

const bucket = new mongoose.Schema({ name: 'string', template: 'mixed', owner: 'string' }, { timestamps: true });
bucket.index({ name: 1 }, { unique: true });

bucket.methods.project = function () {
    return {
        name: this.name,
        template: this.template,
        owner: this.owner
    };
};

module.exports = bucket;