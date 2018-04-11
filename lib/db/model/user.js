const mongoose = require('mongoose');

const user = new mongoose.Schema({ username: 'string', password: 'string', type: 'string' });
user.index({ username: 1 });

user.methods.project = function () {
    return {
        username: this.username,
        type: this.type
    };
};

module.exports = user;