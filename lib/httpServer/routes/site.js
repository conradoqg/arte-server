const express = require('express');
const router = express.Router();
const HTTPError = require('../httpError');
const slug = require('../../util/slug');
const formatters = require('../views/formatters');

/* istanbul ignore next */
module.exports = (dbService, bucketService, artifactService, webhookService, authService) => {
    router.use('/public', express.static('public'));

    router.get(['/', '/artifacts/search'], authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

        const bucketName = slug(req.query.bucket);
        const artifactName = slug(req.query.artifact);
        const version = slug(req.query.version);
        const partial = req.query.partial == 'true';
        const metadata = req.query;

        delete metadata.bucket;
        delete metadata.artifact;
        delete metadata.version;
        delete metadata.partial;


        let message = null;

        const buckets = await bucketService.getBuckets(req);
        const artifacts = await artifactService.findArtifacts(req, bucketName, artifactName, version, metadata, partial);

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
    });

    router.get('/login', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

        res.render('login.pug', {
            pageTitle: 'Login',
            env: process.env.NODE_ENV,
            credential: req.credential
        });
    });

    router.get('/logout', authService.createMiddleware(false), async (req, res) => {
        if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

        res.render('logout.pug', {
            pageTitle: 'Logout',
            env: process.env.NODE_ENV,
            credential: req.credential
        });
    });

    router.get('/users/profile', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

        res.render('profile.pug', {
            pageTitle: 'Profile',
            env: process.env.NODE_ENV,
            credential: req.credential,
            req: req
        });
    });

    router.get('/tokens/grants', authService.createMiddleware(), async (req, res) => {
        if (!req.accepts('html')) throw new HTTPError(406, 'Not Acceptable');

        const buckets = await bucketService.findBucketsByOwner(req);

        res.render('grant.pug', {
            pageTitle: 'Grant',
            env: process.env.NODE_ENV,
            credential: req.credential,
            buckets
        });
    });

    return router;
};