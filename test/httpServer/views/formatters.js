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

        builtURL.should.be.equal('/api/buckets/bucket1/artifacts/artifact1/1.0?os=linux&arch=x86');
    });

    it('should build CLI command for linux/macos', async () => {
        const req = {
            headers: {
                host: 'localhost'
            },
            protocol: 'http'
        };
        const builtCLICommand = formatters.buildCLICommand(req, {
            bucket: 'bucket1',
            name: 'artifact1',
            version: '1.0',
            metadata: {
                os: 'linux',
                arch: 'x86'
            }
        }, 'linux');

        builtCLICommand.should.be.equal('./arte get -b bucket1 -n artifact1 -v 1.0 --metadata.os linux --metadata.arch x86   --url http://localhost');
    });

    it('should build CLI command for windows', async () => {
        const req = {
            headers: {
                host: 'localhost'
            },
            protocol: 'http'
        };
        const builtCLICommand = formatters.buildCLICommand(req, {
            bucket: 'bucket1',
            name: 'artifact1',
            version: '1.0',
            metadata: {
                os: 'linux',
                arch: 'x86'
            }
        }, 'windows');

        builtCLICommand.should.be.equal('arte.exe get -b bucket1 -n artifact1 -v 1.0 --metadata.os linux --metadata.arch x86   --url http://localhost');
    });
});