const mongoose = require('mongoose');
const bucket = require('./model/bucket');
const artifact = require('./model/artifact');
const normalizeVersion = require('../util/versionNormalizer');

const ObjectId = mongoose.Types.ObjectId;

class MetadataDB {
    constructor(configDB) {
        this.configDB = configDB;
    }

    async connect() {
        const config = await this.configDB.getConfig();
        this.connection = await mongoose.createConnection(config.metadataDB);
        this.Bucket = this.connection.model('Bucket', bucket);
        this.Artifact = this.connection.model('Artifact', artifact);
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

    async createBucket(bucketName, template) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');
        if (typeof (template) != 'object') throw new TypeError('The template argument must be an object');

        return await (new this.Bucket({ name: bucketName, template })).save();
    }

    async createOrUpdateArtifact(bucketName, name, version, path, fileSize, metadata) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        const artifacts = await this.findArtifacts(bucketName, name, version, metadata);

        let artifact;
        if (artifacts.length == 0) artifact = await (new this.Artifact({ bucket: bucketName, name, version, normalizedVersion: normalizeVersion(version), path, fileSize, lastUpdate: Date.now(), metadata })).save();
        else artifact = await artifacts[0].set({ lastUpdate: Date.now() }).save();

        return artifact;
    }

    async findArtifact(bucketName, artifactName, version, metadata) {
        let sortMap = new Map();

        const query = {
            bucket: bucketName
        };

        if (bucketName) query.bucket = bucketName;
        if (artifactName) query.name = artifactName;

        // If the version latest key is used, it means to sort by that
        // otherwise, set an equal condition
        if (version == 'latest') sortMap.set('normalizedVersion', -1);
        else if (version == 'oldest') sortMap.set('normalizedVersion', 1);
        else if (version) query.normalizedVersion = normalizeVersion(version);

        Object.keys(metadata).forEach(key => {
            // If the latest key is used it means to sort by that
            // otherwise, set an equal condition
            if (metadata[key] == 'latest') sortMap.set('metadata.' + key, -1);
            else if (metadata[key] == 'oldest') sortMap.set('metadata.' + key, 1);
            else query['metadata.' + key] = metadata[key];
        });

        // Convert the sorted map to object so it can be used with mongoose and the order is respect by it
        let sort = {};
        if (sortMap.size > 0) sort = Array.from(sortMap).reduce((obj, [key, value]) => (Object.assign(obj, { [key]: value })), {});

        return await this.Artifact
            .findOne(query)
            .sort(sort)
            .exec();
    }

    async findArtifacts(bucketName, artifactName, version, metadata, partial = false) {
        let sortMap = new Map();

        const query = {};

        if (bucketName) query.bucket = bucketName;
        if (artifactName) query.name = artifactName;        

        if (artifactName) query.name = (partial ? new RegExp(artifactName, 'i') : artifactName);

        // If the version latest key is used, it means to sort by that
        // otherwise, set an equal condition
        if (version == 'latest') sortMap.set('normalizedVersion', -1);
        else if (version == 'oldest') sortMap.set('normalizedVersion', 1);
        else if (version) query.normalizedVersion = normalizeVersion(version);

        if (metadata) Object.keys(metadata).forEach(key => {
            // If the latest key is used it means to sort by that
            // otherwise, set an equal condition
            if (metadata[key] == 'latest') sortMap.set('metadata.' + key, -1);
            else if (metadata[key] == 'oldest') sortMap.set('metadata.' + key, 1);
            else query['metadata.' + key] = metadata[key];
        });

        // Convert the sorted map to object so it can be used with mongoose and the order is respect by it
        let sort = {};
        if (sortMap.size > 0) sort = Array.from(sortMap).reduce((obj, [key, value]) => (Object.assign(obj, { [key]: value })), {});

        return await this.Artifact
            .find(query)
            .sort(sort)
            .exec();
    }

    deleteArtifact(artifact) {
        return this.Artifact
            .findByIdAndRemove(ObjectId(artifact.id))
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