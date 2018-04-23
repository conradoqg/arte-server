const arteServer = require('./../lib/arte-server');
const yargs = require('yargs');

const argv = yargs  
    .usage('Usage: $0 [options]')  
    .alias('a', 'host')
    .describe('a', 'Host address (localhost by default)')
    .alias('p', 'port')
    .describe('p', 'HTTP port (80 by default)')
    .alias('l', 'log-level')
    .describe('l', 'Log level (7=dir, debug, time and trace; 6=log and info; 4=warn; 3=error, assert; 6 by default).')
    .alias('m', 'mongo-url')
    .describe('m', 'Mongo URL (mongodb://localhost/arte-server by default)')
    .alias('s', 'storage-path')
    .describe('s', 'Storage path (data/storage by default)')
    .alias('d', 'ldap')
    .describe('d', 'Stringified JSON object array with the LDAP configuration')
    .alias('e', 'env')
    .describe('e', 'Environment type (production, development or test; development by default)')
    .help('h')
    .alias('h', 'help')
    .wrap(yargs.terminalWidth()) 
    .argv;

arteServer(argv.host, argv.port, argv.logLevel, argv.mongoUrl, argv.storagePath, argv.ldap, argv.env);