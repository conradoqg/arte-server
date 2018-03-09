const mongoose = require('mongoose');

const bucket = new mongoose.Schema({ name: 'string' });

bucket.methods.project = function () {
    return { name: this.name };
};

module.exports = bucket;