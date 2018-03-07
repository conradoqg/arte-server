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

    step('should get an artifact', async () => {
        const result = await supertest(context.server.app)
            .get('/buckets/bucket1/artifacts/name/1.0?arch=x86')
            .buffer(true)
            .responseType('blob')
            .expect(200);
        result.type.should.be.equal('application/zip');
        result.body.should.be.an.instanceof(Buffer);
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
            .buffer(true)
            .responseType('blob')
            .expect(200);
        result.type.should.be.equal('application/zip');
        result.body.should.be.an.instanceof(Buffer);
    });
});