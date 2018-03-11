const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const util = require('util');
const HTTPError = require('./httpError');
const InvalidOperationError = require('../util/invalidOperationError');
const slug = require('../util/slug');

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

        this.app.get('/buckets/:bucketName', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

            const bucket = await bucketService.getBucket(bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucketName}' not found`);

            res.status(200).json(bucket.project());
        });

        this.app.put('/buckets/:bucketName', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

            const bucket = await bucketService.createBucket(bucketName);

            res.status(200).json(bucket.project());
        });

        const upload = (req, res, next) => {
            const formidable = require('formidable');
            const form = new formidable.IncomingForm();

            form.parse(req);

            form.on('field', function (name, value) {
                if (!req.fields) req.fields = {};
                req.fields[name] = value;
            });

            form.on('file', function (name, file) {
                req.file = file;
            });

            form.on('end', next);

            form.on('error', function (err) {
                next(new HTTPError(400, err.message, null, err));
            });
        };

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
        
        // TODO: Add get by fileName        
        // TODO: Add swagger doc
        // TODO: Add authentication
        // TODO: UI View           

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

            // When a zip is requested always return the first artifact found since it was not specified explicity wich version, the user can order the artifact selection using the metadata query
            if (req.accepts('zip')) {
                const artifacts = await artifactService.getArtifacts(bucket, artifactName, version, metadata);
                let artifact = null;
                if (artifacts.length == 0) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.format(metadata)} not found`);
                artifact = artifacts[0];

                res.status(200).download(await artifactService.getFullPath(artifact.path));
            } else if (req.accepts('json')) {
                let artifacts = await artifactService.getArtifacts(bucket, artifactName, version, metadata, false);
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
            if (artifacts.length == 0) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.format(metadata)} not found`);

            res.status(200).json(artifacts.map(artifact => artifact.project()));
        });

        this.app.use(function (err, req, res, next) {  // eslint-disable-line no-unused-vars                                    
            // Treat invalid operation errors as a bad request
            if (err instanceof InvalidOperationError)
                err = new HTTPError(400, err.message, null, err);
            // Treat all other errors as internal server error
            else if (!(err instanceof HTTPError)) {
                if (err.status) err = new HTTPError(err.status, err.message, null, err);
                else if (err.statusCode) err = new HTTPError(err.statusCode, err.message, null, err);
                else err = new HTTPError(500, null, null, err);
            }

            res.status(err.status);
            console.error(err.toPrint());

            if (process.env.NODE_ENV == 'development') res.json(err);
            else res.json({ status: err.status, message: err.message });
        });
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