const mongoose = require('mongoose');

const user = new mongoose.Schema({ username: String, password: String, roles: [String] }, { timestamps: true });
user.index({ username: 1 }, { unique: true });

user.methods.project = function () {
    return {
        username: this.username,
        roles: this.roles
    };
};

module.exports = user;