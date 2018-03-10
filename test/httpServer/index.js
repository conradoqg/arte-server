const step = require('mocha-steps').step;
const should = require('chai').should();
const supertest = require('supertest');
const path = require('path');
const HTTPServer = require('../../lib/httpServer');
const DB = require('../../lib/db');
const Bucket = require('../../lib/bucket');
const Artifact = require('../../lib/artifact');


describe('HTTPServer', async () => {

    let context = {};

    const createContext = async () => {
        const dbService = new DB('test/data/config.json');
        const config = await dbService.config.getConfig();
        config.storageDB = 'test/data/storage';
        config.metadataDB = 'mongodb://localhost/test';
        config.template.fileName = '{name}-{version}-{tag}-{os}-{arch}-{language}-{country}-{customVersion}.zip';
        config.template.properties.customVersion = {
            default: 'none'
        };
        await dbService.config.updateConfig(config);
        await dbService.connect();
        const bucketServer = new Bucket(dbService.storage, dbService.metadata);
        const artifactServer = new Artifact(dbService.config, dbService.storage, dbService.metadata);
        const server = new HTTPServer(dbService, bucketServer, artifactServer);
        return {
            server,
            dbService
        };
    };

    const deleteContext = async (context) => {
        await context.dbService.destroy();
        await context.dbService.disconnect();
    };

    before(async () => {
        context = await createContext();
    });

    after(async () => {
        await deleteContext(context);
    });

    it('should ping', async () => {
        return await supertest(context.server.app)
            .get('/ping')
            .expect(200);
    });

    step('should not get inexistent bucket', async () => {
        return await supertest(context.server.app)
            .get('/buckets/bucket1')
            .expect(404);
    });

    step('should create bucket', async () => {
        return await supertest(context.server.app)
            .put('/buckets/bucket1')
            .expect(200);
    });

    step('should get buckets', async () => {
        const bucketsResult = await supertest(context.server.app)
            .get('/buckets')
            .expect(200);
        should.exist(bucketsResult.body);
        bucketsResult.body.should.be.an('array');
    });

    step('should post an artifact', async () => {
        const result = await supertest(context.server.app)
            .put('/buckets/bucket1/artifacts/name/1.0')
            .attach('artifact', path.resolve(__dirname, 'file.zip'))
            .field('arch', 'x86')
            .expect(200);
        result.body.should.be.an('object');
    });

    step('should post a newest version of an artifact', async () => {
        const result = await supertest(context.server.app)
            .put('/buckets/bucket1/artifacts/name/2.0')
            .attach('artifact', path.resolve(__dirname, 'file.zip'))
            .field('arch', 'x86')
            .expect(200);
        result.body.should.be.an('object');
    });

    step('should get an artifact data', async () => {
        const result = await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0?arch=x86')
            .accept('application/json')
            .expect(200);
        should.exist(result.body);
        result.body.should.be.an('array').and.to.have.lengthOf(1);
        result.body[0].should.be.deep.equal(
            {
                bucket: 'bucket1',
                name: 'name',
                version: '1.0',
                normalizedVersion: '0000000001.0000000000',
                path: 'bucket1\\name-1.0-undefined-all-x86-all-all-none.zip',
                fileSize: 561,
                metadata: { arch: 'x86', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
            });
    });

    step('should get an artifact file', async () => {
        const result = await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0?arch=x86')
            .accept('application/zip')
            .buffer(true)
            .responseType('blob')
            .expect(200);
        result.type.should.be.equal('application/zip');
        result.body.should.be.an.instanceof(Buffer);
        result.headers['content-disposition'].should.include('name-1.0-undefined-all-x86-all-all-none.zip');
    });

    step('should not get an artifact from an inexistent bucket', async () => {
        return await supertest(context.server.app)
            .get('/buckets/inexistent/artifacts/name/1.0?arch=x86')
            .expect(404);
    });

    step('should not get an inexistent artifact', async () => {
        return await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0?arch=x86_64')
            .expect(404);
    });

    step('should not get an artifact using invalid metadata', async () => {
        return await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0?arch=x64')
            .expect(400);
    });

    step('should get the latest artifact', async () => {
        const result = await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/latest?arch=x86')
            .accept('application/zip')
            .buffer(true)
            .responseType('blob')
            .expect(200);
        result.type.should.be.equal('application/zip');
        result.body.should.be.an.instanceof(Buffer);
        result.headers['content-disposition'].should.include('name-2.0-undefined-all-x86-all-all-none.zip');
    });

    step('should get the latest custom version of two artifacts with a custom version', async () => {
        let result = null;
        result = await supertest(context.server.app)
            .put('/buckets/bucket2/artifacts/name/1.0')
            .attach('artifact', path.resolve(__dirname, 'file.zip'))
            .field('customVersion', '1')
            .expect(200);
        result.body.should.be.an('object');

        result = await supertest(context.server.app)
            .put('/buckets/bucket2/artifacts/name/1.0')
            .attach('artifact', path.resolve(__dirname, 'file.zip'))
            .field('customVersion', '2')
            .expect(200);
        result.body.should.be.an('object');

        result = await supertest(context.server.app)
            .get('/buckets/bucket2/artifacts/name/1.0?customVersion=latest')
            .accept('application/zip')
            .buffer(true)
            .responseType('blob')
            .expect(200);
        result.type.should.be.equal('application/zip');
        result.body.should.be.an.instanceof(Buffer);
        result.headers['content-disposition'].should.include('name-1.0-undefined-all-all-all-all-2.zip');
    });

    step('should get the all the artifacts of version 1', async () => {
        const result = await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0/?arch=x86')            
            .expect(200);
        should.exist(result.body);        
    });
});