const InvalidOperationError = require('../util/invalidOperationError');
const AuthorizationError = require('../auth/authorizationError');

const DEFAULT_TEMPLATE = {
    fileName: '{name}-{version}-{tag}-{os}-{arch}-{language}-{country}.zip',
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
        }
    }
};

class Bucket {
    constructor(storageDB, metadataDB, authService) {
        this.storageDB = storageDB;
        this.metadataDB = metadataDB;
        this.authService = authService;
    }

    async getBuckets(req) {
        if (!await this.authService.checkCredential(req.credential, 'buckets:read')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to read buckets`);

        let buckets = await this.metadataDB.getBuckets();

        return buckets;
    }

    async getBucket(req, bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');        

        let bucket = await this.metadataDB.getBucket(bucketName);

        if (bucket && !await this.authService.checkCredential(req.credential, 'bucket:read', { credential: req.credential, bucket })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to read the bucket`);

        return bucket;
    }

    async findBucketsByOwner(req) {
        return this.metadataDB.findBucketsByOwner(req.credential.username);
    }

    async createBucket(req, bucketName, template) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        if (!await this.authService.checkCredential(req.credential, 'buckets:create')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to create buckets`);

        let bucket = await this.metadataDB.getBucket(bucketName);

        if (bucket) throw new InvalidOperationError(`Bucket '${bucketName}' already exists`);

        template = !template ? DEFAULT_TEMPLATE : template;

        if (!bucket) bucket = await this.metadataDB.createBucket(bucketName, template, req.credential.username);

        return bucket;
    }
}

module.exports = Bucket;