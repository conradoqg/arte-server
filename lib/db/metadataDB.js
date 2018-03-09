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
        let sortMap = new Map();        
        if (version == 'latest') sortMap.set('version', -1);

        const query = {
            bucket: bucketName,
            name
        };

        Object.keys(metadata).forEach(key => {            
            if (metadata[key] == 'latest')
                sortMap.set('metadata.' + key, -1);
            else
                query['metadata.' + key] = metadata[key];
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