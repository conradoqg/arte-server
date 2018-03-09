const InvalidOperationError = require('../util/invalidOperationError');

const zeroPad = (num, places) => {
    const zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join('0') + num;
};

class Artifact {
    constructor(configDB, storageDB, metadataDB) {
        this.configDB = configDB;
        this.storageDB = storageDB;
        this.metadataDB = metadataDB;
    }

    async normalizeMetadata(metadata) {
        const config = await this.configDB.getConfig();
        const template = config.template;

        if (!metadata) metadata = {};

        Object.keys(template.properties).forEach(key => {
            if (template.properties[key].required && !metadata[key]) throw new InvalidOperationError(`The metadata '${key}' is required`);

            if (!metadata[key] && template.properties[key].default) metadata[key] = template.properties[key].default;
            
            if (metadata[key] && metadata[key] != 'latest' && template.properties[key].oneOf && !template.properties[key].oneOf.includes(metadata[key])) throw new InvalidOperationError(`The metadata '${key}' must be one of ${template.properties[key].oneOf}`);
        });

        return metadata;
    }

    async storeArtifact(bucket, artifactName, version, filePath, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (version != null && typeof (version) != 'string') throw new TypeError('The version argument must be a string or null');
        if (typeof (filePath) != 'string') throw new TypeError('The filePath argument must be a string');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        metadata = await this.normalizeMetadata(metadata);

        version = (version ? version : zeroPad((new Date()).getFullYear(), 4) + zeroPad((new Date()).getMonth(), 2) + zeroPad((new Date()).getDate(), 2) + zeroPad((new Date()).getHours(), 2) + zeroPad((new Date()).getMinutes(), 2) + zeroPad((new Date()).getSeconds(), 2));

        const destinationFilename = await this.storageDB.storeArtifact(bucket.name, artifactName, version, filePath, metadata);

        return await this.metadataDB.createArtifact(bucket.name, artifactName, version, destinationFilename, metadata);
    }

    async getArtifact(bucket, artifactName, version, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (typeof (version) != 'string') throw new TypeError('The version argument must be a string');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        metadata = await this.normalizeMetadata(metadata);

        const artifact = await this.metadataDB.findArtifact(bucket.name, artifactName, version, metadata);

        if (artifact) return await this.storageDB.getArtifact(bucket.name, artifact.name, artifact.version, artifact.path, artifact.metadata);
    }

    async getLatestArtifact(bucket, artifactName, metadata) {
        if (typeof (bucket) != 'object') throw new TypeError('The bucket argument must be an object');
        if (typeof (artifactName) != 'string') throw new TypeError('The artifactName argument must be a string');
        if (metadata != null && typeof (metadata) != 'object') throw new TypeError('The metadata argument must be an object or null');

        metadata = await this.normalizeMetadata(metadata);

        const artifact = await this.metadataDB.findLatestArtifact(bucket.name, artifactName, metadata);

        if (artifact) return await this.storageDB.getArtifact(bucket.name, artifact.name, artifact.version, artifact.path, artifact.metadata);
    }
}

module.exports = Artifact;