const mongoose = require('mongoose');
const bucket = require('./model/bucket');
const file = require('./model/file');
const normalizeVersion = require('../util/versionNormalizer');

class MetadataDB {
    constructor(configDB) {
        this.configDB = configDB;
    }

    async connect() {
        const config = await this.configDB.getConfig();
        this.connection = await mongoose.createConnection(config.metadataDB);        
        this.Bucket = this.connection.model('Bucket', bucket);
        this.Artifact = this.connection.model('File', file);
        return;
    }

    async getBuckets() {
        return await this.Bucket
            .find({})
            .exec();
    }

    async getBucket(bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        return await this.Bucket
            .findOne({ name: bucketName })
            .exec();
    }

    async createBucket(bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        return await (new this.Bucket({ name: bucketName })).save();
    }

    async createOrUpdateArtifact(bucketName, name, version, path, fileSize, metadata) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        let artifact = await this.findArtifact(bucketName, name, version, metadata);

        if (!artifact) artifact = await (new this.Artifact({ bucket: bucketName, name, version, normalizedVersion: normalizeVersion(version), path, fileSize, metadata })).save();

        return artifact;
    }

    async findArtifact(bucketName, name, version, metadata) {
        let sortMap = new Map();

        const query = {
            bucket: bucketName,
            name
        };

        if (version == 'latest') sortMap.set('normalizedVersion', -1);
        else if (version == 'oldest') sortMap.set('normalizedVersion', 1);
        else query.normalizedVersion = normalizeVersion(version);

        Object.keys(metadata).forEach(key => {
            if (metadata[key] == 'latest') sortMap.set('metadata.' + key, -1);
            else if (metadata[key] == 'oldest') sortMap.set('metadata.' + key, 1);
            else query['metadata.' + key] = metadata[key];
        });

        let sort = {};
        if (sortMap.size > 0) sort = Array.from(sortMap).reduce((obj, [key, value]) => (Object.assign(obj, { [key]: value })), {});

        return await this.Artifact
            .findOne(query)
            .sort(sort)
            .exec();
    }

    async disconnect() {
        return await this.connection.close();
    }

    async destroy() {
        return await this.connection.db.dropDatabase();
    }
}

module.exports = MetadataDB;