const mongoose = require('mongoose');

const bucket = new mongoose.Schema({ name: 'string', template: 'mixed' });

bucket.methods.project = function () {
    return { name: this.name, template: this.template };
};

module.exports = bucket;