const mongoose = require('mongoose');

class MetadataDB {
    constructor(configDB) {
        this.configDB = configDB;
    }

    async connect() {
        const config = await this.configDB.getConfig();
        this.connection = await mongoose.createConnection(config.metadataDB);
        // TODO: Check what happens when there is a connection error
        this.Bucket = this.connection.model('Bucket', new mongoose.Schema({ name: 'string' }));
        this.Artifact = this.connection.model('File', new mongoose.Schema({ bucket: 'string', name: 'string', version: 'string', path: 'string', metadata: 'mixed' }));
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

    async createArtifact(bucketName, name, version, path, metadata) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        return await (new this.Artifact({ bucket: bucketName, name, version, path, metadata })).save();
    }

    async findArtifact(bucketName, name, version, metadata) {
        const query = {
            bucket: bucketName,
            name,
            version
        };

        Object.keys(metadata).forEach(key => {
            query['metadata.' + key] = metadata[key];
        });

        return await this.Artifact
            .findOne(query)
            .exec();
    }

    async findLatestArtifact(bucketName, name, metadata) {
        const query = {
            bucket: bucketName,
            name
        };

        Object.keys(metadata).forEach(key => {
            query['metadata.' + key] = metadata[key];
        });

        const latestArtifact = await this.Artifact
            .findOne(query)
            .sort({ version: -1 })
            .exec();

        return latestArtifact;
    }

    async disconnect() {
        return await this.connection.close();
    }

    async destroy() {
        return await this.connection.db.dropDatabase();
    }
}

module.exports = MetadataDB;