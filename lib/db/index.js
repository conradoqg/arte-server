const MetadataDB = require('./metadataDB');
const StorageDB = require('./storageDB');

class DB {
    constructor(config) {        
        this.config = config;
        this.metadata = new MetadataDB(this.config.mongoURL);
        this.storage = new StorageDB(this.config.storagePath);
    }

    async connect() {
        return await Promise.all([this.metadata.connect(), this.storage.connect()]);
    }

    async disconnect() {
        return await Promise.all([this.metadata.disconnect(), this.storage.disconnect()]);
    }

    async destroy() {
        return await Promise.all([this.metadata.destroy(), this.storage.destroy()]);
    }
}

module.exports = DB;