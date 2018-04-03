const superagent = require('superagent');
const util = require('util');
const chalk = require('chalk');

module.exports = async (url, content) => {
    console.debug(`Calling webhook ${url} for artifact ${util.inspect(content, { breakLength: Infinity, colors: chalk.supportsColor.level == 0 || !chalk.enabled ? false : true })}`);
    try {
        const response = await superagent
            .post(url)
            .retry()            
            .accept('application/json')
            .send(content);        
        return response;
    } catch (ex) {
        console.error(ex.stack);
    }
};