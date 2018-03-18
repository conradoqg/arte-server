const InvalidOperationError = require('../util/invalidOperationError');

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
    constructor(storageDB, metadataDB) {
        this.storageDB = storageDB;
        this.metadataDB = metadataDB;
    }

    async getBuckets() {
        let buckets = await this.metadataDB.getBuckets();

        return buckets;
    }

    async getBucket(bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        let bucketMetadata = await this.metadataDB.getBucket(bucketName);

        return bucketMetadata;
    }

    async createBucket(bucketName, template) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        let bucketMetadata = await this.metadataDB.getBucket(bucketName);

        if (bucketMetadata) throw new InvalidOperationError(`Bucket '${bucketName}' already exists`);

        template = !template ? DEFAULT_TEMPLATE : template;

        if (!bucketMetadata) bucketMetadata = await this.metadataDB.createBucket(bucketName, template);

        return bucketMetadata;
    }
}

module.exports = Bucket;