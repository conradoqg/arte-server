const step = require('mocha-steps').step;
const should = require('chai').should();
const supertest = require('supertest');
const path = require('path');
const HTTPServer = require('../../lib/httpServer');
const DB = require('../../lib/db');
const Bucket = require('../../lib/bucket');
const Artifact = require('../../lib/artifact');

const EMBEDDED_MONGO = false;

let Mongoose = null;
let mongoose = null;
let Mockgoose = null;
let mockgoose = null;
if (EMBEDDED_MONGO) {
    Mongoose = require('mongoose').Mongoose;
    mongoose = new Mongoose();
    Mockgoose = require('mockgoose').Mockgoose;
    mockgoose = new Mockgoose(mongoose);
}

/*
Test map

get /ping
    get ping -> OK

get /buckets
    get buckets -> []

post /buckets    
    post bucket1 -> bucket1

get /buckets/:bucketName
    get bucket0 -> Error 404
    get bucket1 -> bucket1

put /buckets/:bucketName/artifacts/:artifactName/:version?        
    put bucket1/artifact1/1.0 -> bucket1/artifact1/1.0
    put bucket1/artifact1/1.0 -> bucket1/artifact1/1.0 with a greater lastUpdate
    put bucket1/artifact1/2.0 -> bucket1/artifact1/2.0
    put bucket1/artifact3/1.0?os=linux -> bucket1/artifact3/1.0?os=linux&arch=all
    put bucket1/artifact3/1.0?os=linux&arch=x86 -> bucket1/artifact3/1.0?os=linux&arch=x86
    put bucket1/artifact3/1.0?os=macos -> bucket1/artifact3/1.0?os=macos&arch=all
    put bucket1/artifact3/1.0?os=windows&arch=x86 -> bucket1/artifact3/1.0?os=windows&arch=x86

get /buckets/:bucketName/artifacts/:artifactName/:version? (application/zip)
    get zip bucket1/artifact1 -> bucket1/artifact1/2.0?os=all&arch=all
    get zip bucket1/artifact1/latest -> bucket1/artifact1/2.0?os=all&arch=all
    get zip bucket1/artifact1/oldest -> bucket1/artifact1/1.0?os=all&arch=all
    get zip bucket1/artifact1/1.0 -> bucket1/artifact1/1.0?os=all&arch=all
    get zip bucket1/artifact1/2.0 -> bucket1/artifact1/2.0?os=all&arch=all
    get zip bucket1/artifact1/3.0 -> Error 404
    get bucket1/artifact1/1.0?arch=x2 -> Error 400
    get zip bucket1/artifact2 -> Error 404
    get zip bucket1/artifact2/latest -> Error 404
    get zip bucket1/artifact2/oldest -> Error 404
    get zip bucket1/artifact3/1.0?os=linux -> bucket1/artifact3/1.0?os=linux&arch=all
    get zip bucket1/artifact3/1.0?os=linux&arch=x86 -> bucket1/artifact3/1.0?os=linux&arch=x86
    get zip bucket1/artifact3/1.0?os=macos -> bucket1/artifact3/1.0?os=macos&arch=all
    get zip bucket1/artifact3/1.0?os=latest -> bucket1/artifact3/1.0?os=macos&arch=all
    get zip bucket1/artifact3/1.0?os=windows -> bucket1/artifact3/1.0?os=windows&arch=all -> Error 404
    get zip bucket1/artifact3/1.0?os=all -> bucket1/artifact3/1.0?os=all&arch=all -> Error 404

get /buckets/:bucketName/artifacts/:artifactName/:version? (application/json)
    get bucket1/artifact1 -> [bucket1/artifact1/1.0, bucket1/artifact1/2.0]
    get bucket1/artifact2 -> Error 404
    get bucket1/artifact1/latest -> [ bucket1/artifact1/2.0, bucket1/artifact1/1.0 ]
    get bucket1/artifact1/oldest -> [ bucket1/artifact1/1.0, bucket1/artifact1/2.0 ]
    get bucket1/artifact1/1.0 -> [ bucket1/artifact1/1.0 ]
    get bucket1/artifact1/2.0 -> [ bucket1/artifact1/2.0 ]
    get bucket1/artifact1/3.0 -> []
    get bucket1/artifact3/1.0 -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86, bucket1/artifact3/1.0?os=x86&arch=all, bucket1/artifact3/1.0?os=macos&arch=x86 ]
    get bucket1/artifact3/1.0?os=linux -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86 ]
    get bucket1/artifact3/1.0?os=linux&arch=x86 -> [ bucket1/artifact3/1.0?os=linux&arch=x86 ]
    get bucket1/artifact3/1.0?os=macos -> [ bucket1/artifact3/1.0?os=macos&arch=all ]
    get bucket1/artifact3/1.0?os=macos&arch=all -> [ bucket1/artifact3/1.0?os=macos&arch=all ]
    get bucket1/artifact3/1.0?os=latest -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86, bucket1/artifact3/1.0?os=x86&arch=all, bucket1/artifact3/1.0?os=macos&arch=x86 ]
    get bucket1/artifact3/1.0?os=windows -> [ bucket1/artifact3/1.0?os=windows&arch=x86 ]
    get bucket1/artifact3/1.0?os=all -> []
    get bucket1/artifacts -> [6 items]

delete /buckets/:bucketName/artifacts/:artifactName/:version?
    delete bucket1/artifact1 -> [bucket1/artifact1/1.0, bucket1/artifact1/2.0]

features
    put bucket1/artifact4/{empty} -> bucket1/artifact4/{now}
*/

describe('HTTPServer', async () => {

    let context = {};

    const createContext = async () => {
        if (EMBEDDED_MONGO) await mockgoose.prepareStorage();
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
        if (EMBEDDED_MONGO) {
            await mockgoose.helper.reset();
            await mongoose.disconnect();
            mockgoose.mongodHelper.mongoBin.childProcess.kill('SIGTERM');
        }
    });

    describe('get /ping', async () => {
        // get ping -> OK
        step('should ping', async () => {
            return await supertest(context.server.app)
                .get('/ping')
                .expect(200);
        });
    });

    describe('get /buckets', async () => {
        // get buckets -> []
        step('should get buckets', async () => {
            const bucketsResult = await supertest(context.server.app)
                .get('/buckets')
                .expect(200);
            should.exist(bucketsResult.body);
            bucketsResult.body.should.be.an('array').and.to.have.lengthOf(0);
        });
    });

    describe('post /buckets', async () => {
        // post bucket1 -> bucket1
        step('should create the bucket 1', async () => {
            const bucketsResult = await supertest(context.server.app)
                .post('/buckets')
                .send({
                    name: 'bucket1',
                    template: {
                        fileName: '{name}-{version}-{tag}-{os}-{arch}-{language}-{country}-{customVersion}.zip',
                        properties: {
                            tag: {
                                type: 'string'
                            },
                            os: {
                                type: 'string',
                                oneOf: [
                                    'windows',
                                    'linux',
                                    'macos',
                                    'all'
                                ],
                                default: 'all'
                            },
                            arch: {
                                type: 'string',
                                oneOf: [
                                    'x86',
                                    'x86_64',
                                    'all'
                                ],
                                default: 'all'
                            },
                            language: {
                                type: 'string',
                                default: 'all'
                            },
                            country: {
                                type: 'string',
                                default: 'all'
                            },
                            customVersion: {
                                default: 'none'
                            }
                        }
                    }
                })
                .expect(200);
            should.exist(bucketsResult.body);
            bucketsResult.body.should.be.an('object');
        });
    });

    describe('get /buckets/:bucketName', async () => {
        // get bucket0 -> Error 404
        step('should not get inexistent bucket', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket0')
                .expect(404);
        });

        // get bucket1 -> bucket1
        step('should get bucket 1', async () => {
            const bucketsResult = await supertest(context.server.app)
                .get('/buckets/bucket1')
                .expect(200);
            should.exist(bucketsResult.body);
            bucketsResult.body.should.be.an('object');
            bucketsResult.body.name.should.be.an('string').equal('bucket1');
        });
    });

    describe('put /buckets/:bucketName/artifacts/:artifactName/:version?', async () => {
        // put bucket1/artifact1/1.0 -> bucket1/artifact1/1.0
        step('should create an artifact with version 1.0', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact1/1.0')
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            context.lastUpdate = result.body.lastUpdate;
        });

        // put bucket1/artifact1/1.0 -> bucket1/artifact1/1.0 with a greater lastUpdate
        step('should create an artifact with version 1.0 but with a greater lastUpdate', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact1/1.0')
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            Date.parse(result.body.lastUpdate).should.be.greaterThan(Date.parse(context.lastUpdate));
        });

        // put bucket1/artifact1/2.0 -> bucket1/artifact1/2.0
        step('should create an artifact with version 2.0', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact1/2.0')
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('2.0');
        });

        // put bucket1/artifact3/1.0?os=linux -> bucket1/artifact3/1.0?os=linux&arch=all
        step('should create an artifact with version 1.0 and metadata os=linux', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact3/1.0')
                .field({
                    os: 'linux'
                })
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            result.body.metadata.should.be.an('object');
            result.body.metadata.os.should.be.equal('linux');
            result.body.metadata.arch.should.be.equal('all');
        });

        // put bucket1/artifact3/1.0?os=linux&arch=x86 -> bucket1/artifact3/1.0?os=linux&arch=x86
        step('should create an artifact with version 1.0 and metadata os=linux and arch=x86', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact3/1.0')
                .field({
                    os: 'linux',
                    arch: 'x86'
                })
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            result.body.metadata.should.be.an('object');
            result.body.metadata.os.should.be.equal('linux');
            result.body.metadata.arch.should.be.equal('x86');
        });

        // put bucket1/artifact3/1.0?os=macos -> bucket1/artifact3/1.0?os=macos&arch=all
        step('should create an artifact with version 1.0 and metadata os=macos', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact3/1.0')
                .field({
                    os: 'macos'
                })
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            result.body.metadata.should.be.an('object');
            result.body.metadata.os.should.be.equal('macos');
            result.body.metadata.arch.should.be.equal('all');
        });

        // put bucket1/artifact3/1.0?os=windows&arch=x86 -> bucket1/artifact3/1.0?os=windows&arch=x86
        step('should create an artifact with version 1.0 and metadata os=windows and arch=x86', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact3/1.0')
                .field({
                    os: 'windows',
                    arch: 'x86'
                })
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.be.an('string').equal('1.0');
            result.body.metadata.should.be.an('object');
            result.body.metadata.os.should.be.equal('windows');
            result.body.metadata.arch.should.be.equal('x86');
        });
    });

    describe('get /buckets/:bucketName/artifacts/:artifactName/:version? (application/zip)', async () => {
        // get zip bucket1/artifact1 -> bucket1/artifact1/2.0?os=all&arch=all
        step('should get the artifact 1 without specifying the version', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact1-2.0-undefined-all-all-all-all-none.zip');
        });

        // get zip bucket1/artifact1/latest -> bucket1/artifact1/2.0?os=all&arch=all
        step('should get the latest artifact 1', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/latest')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact1-2.0-undefined-all-all-all-all-none.zip');
        });

        // get zip bucket1/artifact1/oldest -> bucket1/artifact1/1.0?os=all&arch=all
        step('should get the oldest artifact 1', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/oldest')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact1-1.0-undefined-all-all-all-all-none.zip');
        });

        // get zip bucket1/artifact1/1.0 -> bucket1/artifact1/1.0?os=all&arch=all
        step('should get the artifact 1 with version 1.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/1.0')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact1-1.0-undefined-all-all-all-all-none.zip');
        });

        // get zip bucket1/artifact1/2.0 -> bucket1/artifact1/2.0?os=all&arch=all
        step('should get the artifact 1 with version 2.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/2.0')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact1-2.0-undefined-all-all-all-all-none.zip');
        });

        // get zip bucket1/artifact1/3.0 -> Error 404
        step('should not get the artifact 1 with version 3.0', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/3.0')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get zip bucket1/artifact2 -> Error 404        
        step('should not get the artifact 2 without specifying the version', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact2')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get zip bucket1/artifact2/latest -> Error 404
        step('should not get the latest artifact 2', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact2/latest')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get zip bucket1/artifact2/oldest -> Error 404
        step('should not get the oldest artifact 2', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact2/oldest')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get zip bucket1/artifact3/1.0?os=linux -> bucket1/artifact3/1.0?os=linux&arch=all
        step('should get the artifact 3 with version 1.0 and metadata os=linux', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=linux')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact3-1.0-undefined-linux-all-all-all-none.zip');
        });

        // get zip bucket1/artifact3/1.0?os=linux&arch=x86 -> bucket1/artifact3/1.0?os=linux&arch=x86
        step('should get the artifact 3 with version 1.0 and metadata os=linux and arch=x86', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=linux&arch=x86')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact3-1.0-undefined-linux-x86-all-all-none.zip');
        });

        // get zip bucket1/artifact3/1.0?os=macos -> bucket1/artifact3/1.0?os=macos&arch=all
        step('should get the artifact 3 with version 1.0 and metadata os=macos', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=macos')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact3-1.0-undefined-macos-all-all-all-none.zip');
        });

        // get zip bucket1/artifact3/1.0?os=latest -> bucket1/artifact3/1.0?os=macos&arch=all
        step('should get the artifact 3 with version 1.0 and metadata os=latest', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=latest')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(200);
            should.exist(result);
            result.type.should.be.equal('application/zip');
            result.body.should.be.an.instanceof(Buffer);
            result.headers['content-disposition'].should.include('artifact3-1.0-undefined-macos-all-all-all-none.zip');
        });

        // get zip bucket1/artifact3/1.0?os=windows -> bucket1/artifact3/1.0?os=windows&arch=all -> Error 404
        step('should get the artifact 3 with version 1.0 and metadata os=windows', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=windows')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get zip bucket1/artifact3/1.0?os=all -> bucket1/artifact3/1.0?os=all&arch=all -> Error 404
        step('should get the artifact 3 with version 1.0 and metadata os=all', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=all')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });
    });

    describe('get /buckets/:bucketName/artifacts/:artifactName/:version? (application/json)', async () => {
        // get bucket1/artifact1 -> [bucket1/artifact1/1.0, bucket1/artifact1/2.0]
        step('should get all artifacts 1 without specifying a version', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(2);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '2.0',
                    normalizedVersion: '0000000002.0000000000',
                    path: path.normalize('bucket1/artifact1-2.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact1-1.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact2 -> Error 404
        step('should not get the artifact 2', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact2')
                .accept('application/zip')
                .buffer(true)
                .responseType('blob')
                .expect(404);
        });

        // get bucket1/artifact1/latest -> [ bucket1/artifact1/2.0, bucket1/artifact1/1.0 ]
        step('should get the latest artifacts 1', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/latest')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(2);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '2.0',
                    normalizedVersion: '0000000002.0000000000',
                    path: path.normalize('bucket1/artifact1-2.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact1-1.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact1/oldest -> [ bucket1/artifact1/1.0, bucket1/artifact1/2.0 ]
        step('should get the oldest artifacts 1', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/oldest')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(2);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact1-1.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '2.0',
                    normalizedVersion: '0000000002.0000000000',
                    path: path.normalize('bucket1/artifact1-2.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact1/1.0 -> [ bucket1/artifact1/1.0 ]
        step('should get the artifacts 1 with version 1.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/1.0')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact1-1.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact1/2.0 -> [ bucket1/artifact1/2.0 ]
        step('should get the artifacts 1 with version 2.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/2.0')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '2.0',
                    normalizedVersion: '0000000002.0000000000',
                    path: path.normalize('bucket1/artifact1-2.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact1/3.0 -> []
        step('should not get artifacts 1 with version 3.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/3.0')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(0);
        });

        // get bucket1/artifact1/1.0?arch=x2 -> Error 400
        step('should not get artifact 1 using invalid metadata', async () => {
            return await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/1.0?arch=x2')
                .expect(400);
        });

        // get bucket1/artifact3/1.0 -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86, bucket1/artifact3/1.0?os=x86&arch=all, bucket1/artifact3/1.0?os=macos&arch=x86 ]
        step('should get the artifacts 3 with version 1.0', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(4);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'x86', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[2].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-macos-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[2].lastUpdate,
                    metadata: { arch: 'all', os: 'macos', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[3].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-windows-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[3].lastUpdate,
                    metadata: { arch: 'x86', os: 'windows', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=linux -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86 ]
        step('should get the artifacts 3 with version 1.0 and metadata os=linux', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=linux')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(2);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'x86', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=linux&arch=x86 -> [ bucket1/artifact3/1.0?os=linux&arch=x86 ]
        step('should get the artifacts 3 with version 1.0 and metadata os=linux and arch=x86', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=linux&arch=x86')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'x86', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=macos -> [ bucket1/artifact3/1.0?os=macos&arch=all ]
        step('should get the artifacts 3 with version 1.0 and metadata os=macos', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=macos')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-macos-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'macos', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=macos&arch=all -> [ bucket1/artifact3/1.0?os=macos&arch=all ]
        step('should get the artifacts 3 with version 1.0 and metadata os=macos and arch=all', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=macos&arch=all')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-macos-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'macos', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=latest -> [ bucket1/artifact3/1.0?os=linux&arch=all, bucket1/artifact3/1.0?os=linux&arch=x86, bucket1/artifact3/1.0?os=x86&arch=all, bucket1/artifact3/1.0?os=macos&arch=x86 ]
        step('should get the artifacts 3 with version 1.0 and metadata os=latest', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=latest')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(4);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-windows-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'x86', os: 'windows', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-macos-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[1].lastUpdate,
                    metadata: { arch: 'all', os: 'macos', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[2].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[2].lastUpdate,
                    metadata: { arch: 'all', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });
            result.body[3].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-linux-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[3].lastUpdate,
                    metadata: { arch: 'x86', os: 'linux', language: 'all', country: 'all', customVersion: 'none' }
                });

        });

        // get bucket1/artifact3/1.0?os=windows -> [ bucket1/artifact3/1.0?os=windows&arch=x86 ]
        step('should get the artifacts 3 with version 1.0 and metadata os=windows and arch=x86', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact3/1.0?os=windows')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(1);
            result.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact3',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact3-1.0-undefined-windows-x86-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: result.body[0].lastUpdate,
                    metadata: { arch: 'x86', os: 'windows', language: 'all', country: 'all', customVersion: 'none' }
                });
        });

        // get bucket1/artifact3/1.0?os=all -> []
        step('should not get the artifacts 3 with os=all', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1/3.0')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(0);
        });

        // get bucket1/artifacts -> [6]
        step('should get all artifacts from bucket1', async () => {
            const result = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts')
                .accept('application/json')
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('array').and.to.have.lengthOf(6);
        });
    });

    describe('delete /buckets/:bucketName/artifacts/:artifactName/:version?', async () => {
        // delete bucket1/artifact1 -> [bucket1/artifact1/1.0, bucket1/artifact1/2.0]
        step('should delete all artifacts 1 without specifying a version', async () => {
            const deleteResult = await supertest(context.server.app)
                .delete('/buckets/bucket1/artifacts/artifact1')
                .expect(200);
            should.exist(deleteResult.body);
            deleteResult.body.should.be.an('array').and.to.have.lengthOf(2);
            deleteResult.body[0].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '2.0',
                    normalizedVersion: '0000000002.0000000000',
                    path: path.normalize('bucket1/artifact1-2.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: deleteResult.body[0].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });
            deleteResult.body[1].should.be.deep.equal(
                {
                    bucket: 'bucket1',
                    name: 'artifact1',
                    version: '1.0',
                    normalizedVersion: '0000000001.0000000000',
                    path: path.normalize('bucket1/artifact1-1.0-undefined-all-all-all-all-none.zip'),
                    fileSize: 561,
                    lastUpdate: deleteResult.body[1].lastUpdate,
                    metadata: { arch: 'all', os: 'all', language: 'all', country: 'all', customVersion: 'none' }
                });

            const getResult = await supertest(context.server.app)
                .get('/buckets/bucket1/artifacts/artifact1')
                .accept('application/json')
                .expect(200);
            should.exist(getResult.body);
            getResult.body.should.be.an('array').and.to.have.lengthOf(0);
        });
    });

    describe('features', async () => {
        // put bucket1/artifact4/{empty} -> bucket1/artifact4/{now}
        step('should create the artifact 4 with the default version (version=now)', async () => {
            const result = await supertest(context.server.app)
                .put('/buckets/bucket1/artifacts/artifact4')
                .attach('artifact', path.resolve(__dirname, 'file.zip'))
                .expect(200);
            should.exist(result.body);
            result.body.should.be.an('object');
            result.body.version.should.not.be.empty;
        });
    });
});