require('chai').should();
const formatters = require('../../../lib/httpServer/views/formatters');

describe('Formatters', async () => {
    it('should build an URL', async () => {        
        const builtURL = formatters.buildURL({
            bucket: 'bucket1',
            name: 'artifact1',
            version: '1.0',
            metadata: {
                os: 'linux',
                arch: 'x86'
            }
        });

        builtURL.should.be.equal('/buckets/bucket1/artifacts/artifact1/1.0?os=linux&arch=x86');
    });    
});