const slug = require('slug');
slug.defaults.mode ='rfc3986';

module.exports = (string) => (string ? slug(string) : null);