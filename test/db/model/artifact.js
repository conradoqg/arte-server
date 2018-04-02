const step = require('mocha-steps').step;
const should = require('chai').should();
const artifact = require('../../../lib/db/model/artifact');

describe('DB Model', async () => {
    it('should match a simple superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });
        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact1'
        }).should.be.true;
    });

    it('should match a simple regex superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });

        isSubset({            
            artifact: '/^art.*/'
        }).should.be.true;
    });

    it('should match a simple wildcard superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });

        isSubset({            
            artifact: 'art*'
        }).should.be.true;
    });

    it('should not match a simple superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });

        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact2'
        }).should.be.false;
    });

    it('should not match a simple superset (inverted)', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });

        isSubset({
            bucket: 'bucket2',
            artifact: 'artifact1'
        }).should.be.false;
    });

    it('should not match a simple superset (inexistent property)', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                name: 'artifact1'
            });

        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact1'
        }).should.be.false;
    });

    it('should match a simple superset (inexistent property inverted)', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'
            });

        isSubset({
            artifact: 'artifact1'
        }).should.be.true;
    });

    it('should match a object superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1',
                metadata: {
                    os: 'all'
                }
            });

        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact1',
            metadata: {
                os: 'all'
            }
        }).should.be.true;
    });

    it('should not match a object superset', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1',
                metadata: {
                    arch: 'all'
                }
            });

        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact1',
            metadata: {
                os: 'all'
            }
        }).should.be.false;
    });

    it('should not match a object superset (empty object)', async () => {
        const isSubset = artifact.methods.isSubset.bind(
            {
                bucket: 'bucket1',
                name: 'artifact1'                
            });

        isSubset({
            bucket: 'bucket1',
            artifact: 'artifact1',
            metadata: {
                os: 'all'
            }
        }).should.be.false;
    });
});