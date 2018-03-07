const InvalidOperationError = require('../util/invalidOperationError');

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

    async createBucket(bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        let bucketMetadata = await this.metadataDB.getBucket(bucketName);

        if (bucketMetadata) throw new InvalidOperationError(`Bucket '${bucketName}' already exists`);

        if (!bucketMetadata) bucketMetadata = await this.metadataDB.createBucket(bucketName);

        return bucketMetadata;
    }
}

module.exports = Bucket;