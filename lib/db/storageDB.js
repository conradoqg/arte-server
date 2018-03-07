const fs = require('fs-extra');
const path = require('path');

class StorageDB {
    constructor(configDB) {
        this.configDB = configDB;
    }

    async connect() {
        const config = await this.configDB.getConfig();
        this.storagePath = config.storageDB;
    }

    async buildFileName(bucket, name, version, metadata) {
        const config = await this.configDB.getConfig();
        const template = config.template;
        let fileName = template.fileName;
        Object.keys(template.properties).forEach(key => {
            fileName = fileName.replace(`{${key}}`, metadata[key]);
        });
        fileName = fileName.replace('{bucket}', bucket);
        fileName = fileName.replace('{name}', name);
        fileName = fileName.replace('{version}', version);
        return fileName;
    }

    async storeArtifact(bucket, name, version, filePath, metadata) {
        const bucketPath = path.resolve(this.storagePath, bucket);
        const destinationFilename = await this.buildFileName(bucket, name, version, metadata);
        const destinationPath = path.resolve(bucketPath, destinationFilename);

        await fs.ensureDir(bucketPath);
        await fs.move(filePath, destinationPath, { overwrite: true });

        return destinationPath;
    }

    async getArtifact(bucket, name, version, filePath, metadata) {
        const bucketPath = path.resolve(this.storagePath, bucket);
        let artifactFileName = await this.buildFileName(bucket, name, version, metadata);
        const artifactPath = path.resolve(bucketPath, artifactFileName);

        if (await fs.exists(artifactPath)) return artifactPath;
    }

    async disconnect() {        
    }

    async destroy() {
        return (await fs.exists(this.storagePath) ? await fs.remove(this.storagePath) : null);
    }
}

module.exports = StorageDB;