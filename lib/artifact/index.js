const InvalidOperationError = require('../util/invalidOperationError');
const AuthorizationError = require('../auth/authorizationError');

class Artifact {
    constructor(storageDB, metadataDB, webhookService, authService) {
        this.storageDB = storageDB;
        this.metadataDB = metadataDB;
        this.webhookService = webhookService;
        this.authService = authService;
    }

    async findArtifacts(req, bucketName, artifactName, version, metadata, partial = false) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (bucketName != null && typeof (bucketName) != 'string') throw new TypeError('The bucketName argument must be a string or null');
        if (artifactName != null && typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string or null');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        if (!await this.authService.checkCredential(req.credential, 'artifacts:read')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to read artifacts`);

        const artifacts = await this.metadataDB.findArtifacts(bucketName, artifactName, version, metadata, partial);

        return artifacts;
    }

    async createOrUpdateArtifact(req, bucket, artifactName, version, filePath, metadata) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (typeof (filePath) != 'string') throw new TypeError('The filePath argument must be a string');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        metadata = await this.normalizeMetadata(bucket.template, metadata);
        
        version = (version ? version : (new Date()).getFullYear().toString().padStart(4, '0') + (new Date()).getMonth().toString().padStart(2, '0') + (new Date()).getDate().toString().padStart(2, '0') + (new Date()).getHours().toString().padStart(2, '0') + (new Date()).getMinutes().toString().padStart(2, '0') + (new Date()).getSeconds().toString().padStart(4, '0'));        

        let artifact = await this.metadataDB.getArtifact(bucket.name, artifactName, version, metadata);

        if (artifact) {
            if (!await this.authService.checkCredential(req.credential, 'artifact:update', { credential: req.credential, bucket })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to update an artifact`);
            const { fileSize } = await this.storageDB.createOrUpdateArtifact(bucket, artifactName, version, filePath, metadata);
            artifact = await this.metadataDB.updateArtifact(artifact, fileSize);
            this.webhookService.call(req, bucket, 'update', artifact);            
        } else {
            if (!await this.authService.checkCredential(req.credential, 'artifacts:create', { credential: req.credential, bucket })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to create artifacts`);
            const { destinationPath, fileSize } = await this.storageDB.createOrUpdateArtifact(bucket, artifactName, version, filePath, metadata);
            artifact = await this.metadataDB.createArtifact(bucket.name, artifactName, version, destinationPath, fileSize, metadata);
            this.webhookService.call(req, bucket, 'create', artifact);            
        }

        return artifact;
    }

    async getArtifact(req, bucket, artifactName, version, metadata) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        if (!await this.authService.checkCredential(req.credential, 'artifact:read', { credential: req.credential, bucket })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to read the artifact`);

        // Normalize data, so it can be accurate about which artifact to get
        version = (!version ? 'latest' : version);
        metadata = await this.normalizeMetadata(bucket.template, metadata);

        const artifact = await this.metadataDB.getArtifact(bucket.name, artifactName, version, metadata);

        return artifact;
    }

    async removeArtifact(req, bucket, artifactName, version, metadata) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        if (!await this.authService.checkCredential(req.credential, 'artifact:remove', { credential: req.credential, bucket })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to delete the artifact`);

        const artifact = await this.metadataDB.getArtifact(bucket.name, artifactName, version, metadata);

        if (artifact) {
            const deleteMetadataPromise = this.metadataDB.removeArtifact(artifact);
            const deleteStoragePromise = this.storageDB.removeArtifact(bucket, artifact);

            const promises = [deleteMetadataPromise, deleteStoragePromise];

            await Promise.all(promises);

            this.webhookService.call(bucket, 'remove', artifact);
        }

        return artifact;
    }

    async incrementArtifactCounter(artifact, counter) {
        return this.metadataDB.incrementArtifactCounter(artifact, counter);
    }

    async normalizeMetadata(template, metadata) {
        if (!metadata) metadata = {};

        Object.keys(template.properties).forEach(key => {
            if (template.properties[key].required && !metadata[key]) throw new InvalidOperationError(`The metadata '${key}' is required`);

            if (!metadata[key] && template.properties[key].default) metadata[key] = template.properties[key].default;

            if (metadata[key] && metadata[key] != 'latest' && metadata[key] != 'oldest' && template.properties[key].oneOf && !template.properties[key].oneOf.includes(metadata[key])) throw new InvalidOperationError(`The metadata '${key}' must be one of ${template.properties[key].oneOf}`);
        });

        return metadata;
    }

    async getFullPath(relativePath) {
        return this.storageDB.getFullPath(relativePath);
    }
}

module.exports = Artifact;