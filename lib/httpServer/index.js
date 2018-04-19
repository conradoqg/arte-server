const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const error = require('./middleware/error');
const api = require('./routes/api');
const site = require('./routes/site');

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
        
        this.app.use('/', site(dbService, bucketService, artifactService, webhookService, authService));
        this.app.use('/api', api(dbService, bucketService, artifactService, webhookService, authService));        

        this.app.use(error);
    }

    /* istanbul ignore next */
    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the UI go to http://${host}:${this.server.address().port}`);
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