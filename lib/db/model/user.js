const mongoose = require('mongoose');

const user = new mongoose.Schema({ username: String, password: String, roles: [String] });
user.index({ username: 1 });

user.methods.project = function () {
    return {
        username: this.username,
        roles: this.roles
    };
};

module.exports = user;