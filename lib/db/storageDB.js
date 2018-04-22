const fs = require('fs-extra');
const path = require('path');

class StorageDB {
    constructor(storagePath) {
        this.storagePath = storagePath;
    }

    async connect() {
    }

    async disconnect() {
    }

    isHealthy() {
        return true;
    }

    async destroy() {
        return (await fs.exists(this.storagePath) ? await fs.remove(this.storagePath) : null);
    }

    async buildFileName(bucket, name, version, metadata) {
        const template = bucket.template;
        let fileName = template.fileName;
        Object.keys(template.properties).forEach(key => {
            fileName = fileName.replace(`{${key}}`, metadata[key]);
        });
        fileName = fileName.replace('{bucket}', bucket.name);
        fileName = fileName.replace('{name}', name);
        fileName = fileName.replace('{version}', version);
        return fileName;
    }

    async createOrUpdateArtifact(bucket, name, version, filePath, metadata) {
        const bucketPath = path.resolve(this.storagePath, bucket.name);
        const destinationFilename = await this.buildFileName(bucket, name, version, metadata);
        const destinationPath = path.resolve(bucketPath, destinationFilename);

        await fs.ensureDir(bucketPath);
        await fs.move(filePath, destinationPath, { overwrite: true });
        const stat = await fs.stat(destinationPath);
        const fileSize = stat.size;

        return { destinationPath: path.relative(this.storagePath, destinationPath), fileSize };
    }

    async removeArtifact(bucket, artifact) {
        const bucketPath = path.resolve(this.storagePath, artifact.bucket);
        let artifactFileName = await this.buildFileName(bucket, artifact.name, artifact.version, artifact.metadata);
        const artifactPath = path.resolve(bucketPath, artifactFileName);

        if (await fs.exists(artifactPath)) return fs.unlink(artifactPath);
    }

    async getFullPath(relativePath) {
        return path.resolve(this.storagePath, relativePath);
    }
}

module.exports = StorageDB;