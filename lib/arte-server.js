const CFonts = require('cfonts');
const chalk = require('chalk');
const Config = require('./config');
const DB = require('./db');
const HTTPServer = require('./httpServer');
const Bucket = require('./bucket');
const Artifact = require('./artifact');
const Webhook = require('./webhook');
const Auth = require('./auth');
const Metric = require('./metric');
const package = require('../package.json');
const consoleWrapper = require('./util/consoleWrapper.js');

module.exports = function arteServer(host, port, logLevel, mongoURL, storagePath, ldap, env) {
    process.env.HOST = host = process.env.HOST || host || 'localhost';
    process.env.PORT = port = process.env.PORT || process.env.HTTP_PORT || port || 80;
    process.env.LOG_LEVEL = logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);
    process.env.MONGO_URL = mongoURL = (process.env.MONGO_URL ? process.env.MONGO_URL : mongoURL || 'mongodb://localhost/arte-server');
    process.env.STORAGE_PATH = storagePath = (process.env.STORAGE_PATH ? process.env.STORAGE_PATH : storagePath || 'data/storage');
    process.env.LDAP = ldap = (process.env.LDAP ? process.env.LDAP : ldap || `[{
            "url": "ldap://ldap.forumsys.com:389",
            "bindDN": "cn=read-only-admin,dc=example,dc=com",
            "bindCredentials": "password",
            "searchBase": "ou=mathematicians,dc=example,dc=com",
            "searchFilter": "(uid={{username}})"
        }]`);
    process.env.NODE_ENV = env = (process.env.NODE_ENV ? process.env.NODE_ENV : process.env.NODE_ENV || env || 'development');

    CFonts.say('arte-server!', { font: 'chrome', align: 'left', colors: ['red', 'green', 'blue'] });
    console.info(`Version: ${package.version}\nMode: ${process.env.NODE_ENV == 'development' ? chalk.blue(process.env.NODE_ENV) : chalk.red(process.env.NODE_ENV)}`);

    consoleWrapper('arte-server', logLevel);

    (async () => {
        try {
            const config = new Config(mongoURL, storagePath);
            const dbService = new DB(config);
            await dbService.connect();            
            const authService = new Auth(dbService.metadata, JSON.parse(ldap));
            const bucketService = new Bucket(dbService.storage, dbService.metadata, authService);
            const webhookService = new Webhook(dbService.metadata);
            const artifactService = new Artifact(dbService.storage, dbService.metadata, webhookService, authService);
            const metricService = new Metric(authService);
            const server = new HTTPServer(dbService, bucketService, artifactService, webhookService, authService, metricService);

            server.listen(host, port);
        } catch (ex) {
            if (ex.toPrint) console.error(ex.toPrint());
            else console.error(ex);
            process.exit(1);
        }
    })();
};