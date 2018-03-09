const mongoose = require('mongoose');

const bucket = new mongoose.Schema({ name: 'string' });

module.exports = bucket;