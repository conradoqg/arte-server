const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const util = require('util');
const HTTPError = require('./httpError');
const AuthorizationError = require('../auth/authorizationError');
const AuthenticationError = require('../auth/authenticationError');
const InvalidOperationError = require('../util/invalidOperationError');
const slug = require('../util/slug');
const upload = require('./middleware/upload');
const error = require('./middleware/error');
const formatters = require('./views/formatters');

class HTTPServer {
    constructor(dbService, bucketService, artifactService, webhookService, authService) {
        this.app = express();

        this.dbService = dbService;
        this.bucketService = bucketService;
        this.artifactService = artifactService;
        this.webhookService = webhookService;
        this.authService = authService;

        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'views'));

        this.app.enable('trust proxy');

        this.app.use(compression());
        this.app.use(helmet());
        this.app.use(bodyParser.json());
        this.app.use(cookieParser());
        this.app.use('/public', express.static('public'));

        this.app.get('/ping', (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');
            res.status(200).json('pong');
        });

        this.app.get('/throw', () => {
            throw new Error('Yes, I\'m throwing at you!');
        });

        this.app.get('/buckets', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const buckets = await bucketService.getBuckets(req.credential);

            res.status(200).json(buckets.map(bucket => bucket.project()));
        });

        this.app.post('/buckets', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.body.name);
            const template = req.body.template;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

            const bucket = await bucketService.createBucket(req.credential, bucketName, template);

            res.status(200).json(bucket.project());
        });

        this.app.get('/buckets/:bucketName', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');

            const bucket = await bucketService.getBucket(req.credential, bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucketName}' not found`);

            res.status(200).json(bucket.project());
        });

        this.app.put('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), upload, async (req, res) => {
            if (!req.accepts('form-data')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.fields;
            const filePath = req.file.path;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            let bucket = await bucketService.getBucket(req.credential, bucketName);

            if (!bucket) bucket = await bucketService.createBucket(bucketName);

            const artifact = await artifactService.storeArtifact(bucket, artifactName, version, filePath, metadata);

            res.status(200).json(artifact.project());
        });

        // TODO: Add retention policy        
        // TODO: Add authentication/authorization        
        // TODO: Add get by fileName        
        // TODO: Add swagger doc      
        // TODO: Allow setting the default os 
        // TODO: Keep track of download count and order by download count 

        this.app.get('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json') && !req.accepts('zip')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.query;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            const bucket = await bucketService.getBucket(req.credential, bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

            const artifact = await artifactService.getArtifact(bucket, artifactName, version, metadata);
            if (!artifact) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);

            if (req.accepts('zip')) {
                res.status(200).download(await artifactService.getFullPath(artifact.path));
            } else {
                res.status(200).json(artifact.project());
            }

        });

        this.app.delete('/buckets/:bucketName/artifacts/:artifactName/:version?', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.params.bucketName);
            const artifactName = slug(req.params.artifactName);
            const version = slug(req.params.version);
            const metadata = req.query;

            if (!bucketName || typeof (bucketName) != 'string') throw new HTTPError(400, 'The bucketName parameter must be a string');
            if (!artifactName || typeof (artifactName) != 'string') throw new HTTPError(400, 'The artifactName parameter must be a string');

            const bucket = await bucketService.getBucket(req.credential, bucketName);

            if (!bucket) throw new HTTPError(404, `Bucket '${bucket}' not found`);

            const artifact = await artifactService.deleteArtifact(bucket, artifactName, version, metadata);
            if (artifact == null) throw new HTTPError(404, `Artifact '${artifactName}' version '${version}' from bucket '${bucketName}' with the metadata ${util.inspect(metadata, { breakLength: Infinity })} not found`);

            res.status(200).json(artifact.project());
        });

        this.app.get(['/', '/artifacts/search'], authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('json') && !req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

            const bucketName = slug(req.query.bucket);
            const artifactName = slug(req.query.artifact);
            const version = slug(req.query.version);
            const partial = req.query.partial == 'true';
            const metadata = req.query;

            delete metadata.bucket;
            delete metadata.artifact;
            delete metadata.version;
            delete metadata.partial;

            if (req.accepts('html')) {
                let message = null;

                const buckets = await bucketService.getBuckets(req.credential);
                const artifacts = await artifactService.findArtifacts(bucketName, artifactName, version, metadata, partial);

                if (artifacts.length == 0) message = 'No artifacts found';

                res.render('index.pug', {
                    pageTitle: 'Artifact search',
                    env: process.env.NODE_ENV,
                    credential: req.credential,
                    bucketName,
                    buckets,
                    artifactName,
                    artifacts,
                    version,
                    metadata,
                    message,
                    formatters,
                    req
                });
            } else if (req.accepts('json')) {
                let artifacts = await artifactService.findArtifacts(bucketName, artifactName, version, metadata, partial);
                res.status(200).json(artifacts.map(artifact => artifact.project()));
            }
        });

        this.app.get('/login', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

            res.render('login.pug', {
                pageTitle: 'Login',
                env: process.env.NODE_ENV,
                credential: req.credential
            });
        });

        this.app.get('/logout', authService.createMiddleware(false), async (req, res) => {
            if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

            res.render('logout.pug', {
                pageTitle: 'Logout',
                env: process.env.NODE_ENV,
                credential: req.credential
            });
        });

        this.app.post('/webhooks', async (req, res) => {
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

        // TODO: Move authService.createMiddleware to the correct place
        this.app.get('/users', authService.createMiddleware(), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            try {
                const users = await authService.getUsers(req.credential);

                res.status(200).json(users.map(user => user.project()));
            } catch (ex) {
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.post('/users', authService.createMiddleware(), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const username = req.body.username;
            const password = req.body.password;
            const roles = req.body.roles;

            if (username == null || password == null) throw new HTTPError(400, 'The username and/or password parameter must be a string');

            try {
                const userCreated = await authService.createUser(req.credential, username, password, roles);

                res.status(200).json(userCreated.project());
            } catch (ex) {
                if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.put('/users', authService.createMiddleware(), async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            const username = req.body.username;
            const password = req.body.password;
            const roles = req.body.roles;

            if (username == null) throw new HTTPError(400, 'The username parameter must be a string');

            try {
                const userUpdated = await authService.updateUser(req.credential, username, password, roles);

                res.status(200).json(userUpdated.project());
            } catch (ex) {
                if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.post('/tokens', async (req, res) => {
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

        this.app.get('/tokens/:token', async (req, res) => {
            if (!req.accepts('json')) throw new HTTPError(406, 'Not Acceptable');

            try {
                const token = req.params.token;

                if (!token) throw new HTTPError(400, 'The token parameter must be a string');

                const tokenData = await authService.getToken(token);

                res.status(200).json(tokenData);
            } catch (ex) {
                if (ex instanceof AuthenticationError) throw new HTTPError(401, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.use(error);
    }

    /* istanbul ignore next */
    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                this.authService.isUsersEmpty()
                    .then((isEmpty) => {
                        if (isEmpty) return this.authService.getFirstTimeToken();
                    })
                    .then((token) => {
                        if (token) console.info(`Initial token to create new superusers (expires in 5 hours): ${token}`);
                        resolve(this);
                    });
            });
        });
    }

    /* istanbul ignore next */
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