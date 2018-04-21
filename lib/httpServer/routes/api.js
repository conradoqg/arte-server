const express = require('express');
const router = express.Router();
const HTTPError = require('../httpError');
const util = require('util');
const AuthenticationError = require('../../auth/authenticationError');
const InvalidOperationError = require('../../util/invalidOperationError');
const slug = require('../../util/slug');
const upload = require('../middleware/upload');

module.exports = (dbService, bucketService, artifactService, webhookService, authService) => {
    router.get('/ping', (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');
        res.status(200).json('pong');
    });

    router.get('/throw', () => {
        throw new Error('Yes, I\'m throwing at you!');
    });

    router.get('/buckets', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const buckets = await bucketService.getBuckets(req);

        res.status(200).json(buckets.map(bucket => bucket.project()));
    });

    router.post('/buckets', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.body.name);
        const template = req.body.template;

        if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

        const bucket = await bucketService.createBucket(req, bucketName, template);

        res.status(200).json(bucket.project());
    });

    router.get('/buckets/:bucketName', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.params.bucketName);

        if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

        const bucket = await bucketService.getBucket(req, bucketName);

        if (!bucket) throw new HTTPError(404, `Bucket '${bucketName}' not found`);

        res.status(200).json(bucket.project());
    });

    router.put('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), upload, async (req, res) => {
        if (!req.accepts('form-data')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.params.bucketName);
        const artifactName = slug(req.params.artifactName);
        const version = slug(req.params.version);
        const metadata = req.fields;
        const filePath = req.file.path;

        if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
        if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

        let bucket = await bucketService.getBucket(req, bucketName);

        if (!bucket) bucket = await bucketService.createBucket(req, bucketName);

        const artifact = await artifactService.createOrUpdateArtifact(req, bucket, artifactName, version, filePath, metadata);

        res.status(200).json(artifact.project());
    });

    // TODO: Add retention policy        
    // TODO: Add get by fileName        
    // TODO: Add swagger doc      
    // TODO: Allow setting the default os 
    // TODO: Keep track of download count and order by download count 

    router.get('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json') && !req.accepts('zip')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.params.bucketName);
        const artifactName = slug(req.params.artifactName);
        const version = slug(req.params.version);
        const metadata = req.query;

        if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
        if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

        const bucket = await bucketService.getBucket(req, bucketName);

        if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

        const artifact = await artifactService.getArtifact(req, bucket, artifactName, version, metadata);
        if (!artifact) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);

        if (req.accepts('zip')) {
            res.status(200).download(await artifactService.getFullPath(artifact.path));
        } else {
            res.status(200).json(artifact.project());
        }

    });

    router.delete('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.params.bucketName);
        const artifactName = slug(req.params.artifactName);
        const version = slug(req.params.version);
        const metadata = req.query;

        if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
        if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

        const bucket = await bucketService.getBucket(req, bucketName);

        if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

        const artifact = await artifactService.removeArtifact(req, bucket, artifactName, version, metadata);
        if (artifact == null) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);

        res.status(200).json(artifact.project());
    });

    router.get('/artifacts/search', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.query.bucket);
        const artifactName = slug(req.query.artifact);
        const version = slug(req.query.version);        
        const metadata = req.query;
        const partial = req.query.partial == 'true';

        delete metadata.bucket;
        delete metadata.artifact;
        delete metadata.version;
        delete metadata.partial;

        let artifacts = await artifactService.findArtifacts(req, bucketName, artifactName, version, metadata, partial);
        res.status(200).json(artifacts.map(artifact => artifact.project()));
    });

    router.post('/webhooks', async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const bucket = req.body.bucket ? slug(req.body.bucket) : req.body.bucket;
        const artifact = req.body.artifact ? slug(req.body.artifact) : req.body.artifact;
        const version = req.body.version ? slug(req.body.version) : req.body.version;
        const metadata = req.body.metadata;
        const endpoint = req.body.endpoint;

        if (!bucket || typeof (bucket) != 'string') throw new HTTPError(400, 'The bucket property must be a string');

        let webhook = { bucket, artifact, version, metadata, endpoint };

        webhook = await webhookService.post(webhook);

        res.status(200).json(webhook.project());
    });

    router.get('/users', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const users = await authService.getUsers(req);

        res.status(200).json(users.map(user => user.project()));
    });

    router.post('/users', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const username = req.body.username;
        const password = req.body.password;
        const roles = req.body.roles;

        if (username == null || password == null) throw new HTTPError(400, 'The username and/or password parameter must be a string');

        try {
            const userCreated = await authService.createUser(req, username, password, roles);

            res.status(200).json(userCreated.project());
        } catch (ex) {
            if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
            else throw ex;
        }
    });

    router.put('/users', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const username = req.body.username;
        const password = req.body.password;
        const roles = req.body.roles;

        if (username == null) throw new HTTPError(400, 'The username parameter must be a string');

        const userUpdated = await authService.updateUser(req, username, password, roles);

        res.status(200).json(userUpdated.project());
    });

    // TODO: Add get and remove for /users/:username

    router.post('/tokens', async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        try {
            const username = req.body.username;
            const password = req.body.password;

            if (username == null || password == null) throw new HTTPError(400, 'The username and/or password parameter must be a string');

            const token = await authService.createToken(username, password);

            res.status(200).json({ token });
        } catch (ex) {
            if (ex instanceof AuthenticationError) throw new HTTPError(401, ex.message, null, ex);
            else throw ex;
        }
    });

    router.get('/tokens/:token', async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const token = req.params.token;

        if (!token) throw new HTTPError(400, 'The token parameter must be a string');

        const tokenData = await authService.getToken(token);

        res.status(200).json(tokenData);
    });

    router.post('/tokens/grants', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

        const username = req.body.username;
        const buckets = req.body.grants.buckets;
        const artifactsCreate = (req.body.grants.artifactsCreate == null ? false : req.body.grants.artifactsCreate);
        const artifactUpdate = (req.body.grants.artifactUpdate == null ? false : req.body.grants.artifactUpdate);
        const artifactRemove = (req.body.grants.artifactRemove == null ? false : req.body.grants.artifactRemove);

        if (username == null) throw new HTTPError(400, 'The username parameter must be a string');

        const token = await authService.createGrantToken(req, username, buckets, artifactsCreate, artifactUpdate, artifactRemove);

        res.status(200).json({ token });
    });

    return router;
};