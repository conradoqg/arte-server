const versionNormalizer = require('../../lib/util/versionNormalizer');
const should = require('chai').should();

describe('Version normalizer', async () => {

    it('should normalize 1.1.1', async () => {
        const normalized = versionNormalizer('1.1.1');
        normalized.should.be.equal('0000000001.0000000001.0000000001');
    });

    it('should normalize 1.1.A.1', async () => {
        const normalized = versionNormalizer('1.1.A.1');
        normalized.should.be.equal('0000000001.0000000001.A.0000000001');
    });

    it('should normalize A.1.A.A', async () => {
        const normalized = versionNormalizer('A.1.A.A');
        normalized.should.be.equal('A.0000000001.A.A');
    });

    it('should normalize 1.1.1.1-A', async () => {
        const normalized = versionNormalizer('1.1.1.1-A');
        normalized.should.be.equal('0000000001.0000000001.0000000001.0000000001-A');
    });

    it('should normalize 1.1.1.1-SNAPSHOT-v1', async () => {
        const normalized = versionNormalizer('1.1.1.1-SNAPSHOT-v1');
        normalized.should.be.equal('0000000001.0000000001.0000000001.0000000001-SNAPSHOT-v0000000001');
    });

    it('should normalize v.10', async () => {
        const normalized = versionNormalizer('v11.10');
        normalized.should.be.equal('v0000000011.0000000010');
    });

    it('should normalize v11.funny/12/version-1', async () => {
        const normalized = versionNormalizer('v11.funny/12/version-1');
        normalized.should.be.equal('v0000000011.funny/0000000012/version-0000000001');
    });
});