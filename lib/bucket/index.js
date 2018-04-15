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

    async getBuckets(credential) {
        if (!await this.authService.checkCredential(credential, 'buckets:read')) throw new AuthorizationError(`The user '${credential.username}' is not authorized to read buckets`);

        let buckets = await this.metadataDB.getBuckets();

        return buckets;
    }

    async getBucket(credential, bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');        

        let bucket = await this.metadataDB.getBucket(bucketName);

        if (!await this.authService.checkCredential(credential, 'bucket:read', { credential, bucket })) throw new AuthorizationError(`The user '${credential.username}' is not authorized to read the bucket`);

        return bucket;
    }

    async createBucket(credential, bucketName, template) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        if (!await this.authService.checkCredential(credential, 'buckets:create')) throw new AuthorizationError(`The user '${credential.username}' is not authorized to create buckets`);

        let bucket = await this.metadataDB.getBucket(bucketName);

        if (bucket) throw new InvalidOperationError(`Bucket '${bucketName}' already exists`);

        template = !template ? DEFAULT_TEMPLATE : template;

        if (!bucket) bucket = await this.metadataDB.createBucket(bucketName, template);

        return bucket;
    }
}

module.exports = Bucket;