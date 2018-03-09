const mongoose = require('mongoose');

const file = new mongoose.Schema({ bucket: 'string', name: 'string', version: 'string', normalizedVersion: 'string', path: 'string', metadata: 'mixed' });
file.index({bucket: 1, name: 1});
file.index({bucket: 1, name: 1, normalizedVersion: 1});
file.index({bucket: 1, name: 1, normalizedVersion: -1});

module.exports = file;