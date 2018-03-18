const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const util = require('util');
const HTTPError = require('./httpError');
const slug = require('../util/slug');
const upload = require('./middleware/upload');
const error = require('./middleware/error');

class HTTPServer {
    constructor(dbService, bucketService, artifactService) {
        this.app = express();

        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'views'));

        this.app.enable('trust proxy');

        this.app.use(compression());
        this.app.use(helmet());
        this.app.use(bodyParser.json());

        this.app.get('/ping', (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');
            res.status(200).json('pong');
        });

        this.app.get('/buckets', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const buckets = await bucketService.getBuckets();

            res.status(200).json(buckets.map(bucket => bucket.project()));
        });

        this.app.post('/buckets', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.body.name);
            const template = req.body.template;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            
            const bucket = await bucketService.createBucket(bucketName, template);

            res.status(200).json(bucket.project());
        });

        this.app.get('/buckets/:bucketName', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

            const bucket = await bucketService.getBucket(bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucketName}' not found`);

            res.status(200).json(bucket.project());
        });

        this.app.put('/buckets/:bucketName/artifacts/:artifactName/:version?', upload, async (req, res) => {
            if (!req.accepts('form-data')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.fields;
            const filePath = req.file.path;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            let bucket = await bucketService.getBucket(bucketName);

            if (!bucket) bucket = await bucketService.createBucket(bucketName);

            const artifact = await artifactService.storeArtifact(bucket, artifactName, version, filePath, metadata);

            res.status(200).json(artifact.project());
        });
                
        // TODO: Add retention policy
        // TODO: Add webhook feature
        // TODO: Add authentication
        // TODO: UI View
        // TODO: Add get by fileName        
        // TODO: Add swagger doc        

        this.app.get('/buckets/:bucketName/artifacts/:artifactName/:version?', async (req, res) => {
            if (!req.accepts('json') && !req.accepts('zip')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.query;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            const bucket = await bucketService.getBucket(bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

            // When a zip is requested only return if there is only one artifact with the given signature
            if (req.accepts('zip')) {
                const artifact = await artifactService.getArtifact(bucket, artifactName, version, metadata);
                if (!artifact) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);
                res.status(200).download(await artifactService.getFullPath(artifact.path));
            } else if (req.accepts('json')) {
                let artifacts = await artifactService.getArtifacts(bucket, artifactName, version, metadata);
                res.status(200).json(artifacts.map(artifact => artifact.project()));
            }
        });

        this.app.delete('/buckets/:bucketName/artifacts/:artifactName/:version?', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.query;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            const bucket = await bucketService.getBucket(bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

            const artifacts = await artifactService.deleteArtifacts(bucket, artifactName, version, metadata);
            if (artifacts.length == 0) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);

            res.status(200).json(artifacts.map(artifact => artifact.project()));
        });

        this.app.use(error);
    }

    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                resolve(this);
            });
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                console.info('Closing http');
                resolve(this);
            });
        });
    }
}

module.exports = HTTPServer;