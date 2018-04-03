const should = require('chai').should();
const webhookCaller = require('../../lib/util/webhookCaller');

describe('webhookCaller', async () => {
    it('should successfully call the webhook', async () => {
        const response = await webhookCaller('https://httpbin.org/post', { data: 'data' });
        should.exist(response);
        response.body.should.be.an('object');
        response.status.should.be.equal(200);
    });

    it('should unsuccessfully call the webhook', async () => {
        const response = await webhookCaller('https://httpbin.org/status/404', { data: 'data' });
        should.not.exist(response);        
    });
});