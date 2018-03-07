const figlet = require('figlet');
const chalk = require('chalk');
const DB = require('./db');
const HTTPServer = require('./httpServer');
const Bucket = require('./bucket');
const Artifact = require('./artifact');
const package = require('../package.json');

module.exports = function arteServer(host, port, logLevel) {
    host = process.env.HOST || host || 'localhost';
    port = process.env.PORT || process.env.HTTP_PORT || port || 80;
    logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);

    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    console.info(`
${figlet.textSync('arte-server')}
Version: ${package.version} 
Mode: ${process.env.NODE_ENV == 'development' ? chalk.blue(process.env.NODE_ENV) : chalk.red(process.env.NODE_ENV)}`);

    require('./util/consoleWrapper.js')('arte-server', logLevel);

    (async () => {
        try {
            const dbService = new DB();
            await dbService.connect();
            const bucketService = new Bucket(dbService.storage, dbService.metadata);
            const artifactService = new Artifact(dbService.config, dbService.storage, dbService.metadata);
            const server = new HTTPServer(dbService, bucketService, artifactService);

            server.listen(host, port);
        } catch (ex) {
            console.error(ex);
        }
    })();
};