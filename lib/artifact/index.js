const InvalidOperationError = require('../util/invalidOperationError');

class Artifact {
    constructor(configDB, storageDB, metadataDB, webhookService) {
        this.configDB = configDB;
        this.storageDB = storageDB;
        this.metadataDB = metadataDB;
        this.webhookService = webhookService;
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

    async storeArtifact(bucket, artifactName, version, filePath, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (typeof (filePath) != 'string') throw new TypeError('The filePath argument must be a string');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        metadata = await this.normalizeMetadata(bucket.template, metadata);

        version = (version ? version : (new Date()).getFullYear().toString().padStart(4, '0') + (new Date()).getMonth().toString().padStart(2, '0') + (new Date()).getDate().toString().padStart(2, '0') + (new Date()).getHours().toString().padStart(2, '0') + (new Date()).getMinutes().toString().padStart(2, '0') + (new Date()).getSeconds().toString().padStart(4, '0'));

        const { destinationPath, fileSize } = await this.storageDB.storeArtifact(bucket, artifactName, version, filePath, metadata);

        const artifact = await this.metadataDB.createOrUpdateArtifact(bucket.name, artifactName, version, destinationPath, fileSize, metadata);
        await this.webhookService.call(bucket, artifact);

        return artifact;
    }

    async getArtifact(bucket, artifactName, version, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');

        // Normalize data, so it can be accurate about which artifact to get
        version = (!version ? 'latest' : version);
        metadata = await this.normalizeMetadata(bucket.template, metadata);

        const artifact = await this.metadataDB.findArtifact(bucket.name, artifactName, version, metadata);

        return artifact;
    }

    async findArtifacts(bucketName, artifactName, version, metadata, partial = false) {
        const artifacts = await this.metadataDB.findArtifacts(bucketName, artifactName, version, metadata, partial);

        return artifacts;
    }

    async deleteArtifact(bucket, artifactName, version, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');

        const artifact = await this.metadataDB.findArtifact(bucket.name, artifactName, version, metadata);

        if (artifact) {
            const deleteMetadataPromise = this.metadataDB.deleteArtifact(artifact);
            const deleteStoragePromise = this.storageDB.removeArtifact(bucket, artifact);

            const promises = [deleteMetadataPromise, deleteStoragePromise];

            await Promise.all(promises);
        }

        return artifact;
    }

    async getFullPath(relativePath) {
        return this.storageDB.getFullPath(relativePath);
    }
}

module.exports = Artifact;