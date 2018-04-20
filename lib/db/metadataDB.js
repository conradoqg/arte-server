const mongoose = require('mongoose');
const bucket = require('./model/bucket');
const artifact = require('./model/artifact');
const webhook = require('./model/webhook');
const user = require('./model/user');
const normalizeVersion = require('../util/versionNormalizer');
const InvalidOperationError = require('../util/invalidOperationError');

const ObjectId = mongoose.Types.ObjectId;

class MetadataDB {
    constructor(mongoURL) {
        this.mongoURL = mongoURL;
    }

    async connect() {
        this.connection = await mongoose.createConnection(this.mongoURL);
        this.Bucket = this.connection.model('Bucket', bucket);
        this.Artifact = this.connection.model('Artifact', artifact);
        this.Webhook = this.connection.model('Webhook', webhook);
        this.User = this.connection.model('User', user);
        return;
    }

    async getBuckets() {
        return await this.Bucket
            .find({})
            .exec();
    }

    findBucketsByOwner(owner) {
        return this.Bucket
            .find({
                owner
            })
            .exec();
    }

    async getBucket(bucketName) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        return await this.Bucket
            .findOne({ name: bucketName })
            .exec();
    }

    async createBucket(bucketName, template, owner) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');
        if (typeof (template) != 'object') throw new TypeError('The template argument must be an object');

        return await (new this.Bucket({ name: bucketName, template, owner })).save();
    }

    async createArtifact(bucketName, name, version, path, fileSize, metadata) {
        if (typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string');

        return (new this.Artifact({ bucket: bucketName, name, version, normalizedVersion: normalizeVersion(version), path, fileSize, lastUpdate: Date.now(), metadata })).save();
    }

    async updateArtifact(artifact, fileSize) {
        return await artifact.set({ fileSize, updatedAt: Date.now() }).save();
    }

    // TODO: Join parameters in an object
    async getArtifact(bucketName, artifactName, version, metadata) {
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

    removeArtifact(artifact) {
        return this.Artifact
            .findByIdAndRemove(ObjectId(artifact.id))
            .exec();
    }

    async createWebhook(webhook) {
        if (webhook.version) webhook.normalizedVersion = normalizeVersion(webhook.version);
        const newWebhook = new this.Webhook(webhook);
        return await newWebhook.save();
    }

    getWebhooks(bucket) {
        return this.Webhook
            .find({
                bucket
            })
            .exec();
    }

    getUsers() {
        return this.User
            .find({})
            .exec();
    }

    getUsersCount() {
        return this.User
            .count()
            .exec();
    }

    findUserByUsername(username) {
        return this.User
            .find({ username })
            .findOne()
            .exec();
    }

    createUser(user) {
        const newUser = new this.User(user);
        return newUser.save();
    }

    updateUser(user) {
        return user.save();
    }

    async disconnect() {
        return await this.connection.close();
    }

    async destroy() {
        return await this.connection.db.dropDatabase();
    }
}

module.exports = MetadataDB;