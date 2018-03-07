const ConfigDB = require('./configDB');
const MetadataDB = require('./metadataDB');
const StorageDB = require('./storageDB');

class DB {
    constructor(configPath = 'data/config.json') {
        this.configPath = configPath;
        this.config = new ConfigDB(this.configPath);
        this.metadata = new MetadataDB(this.config);
        this.storage = new StorageDB(this.config);
    }

    async connect() {
        return await Promise.all([this.metadata.connect(), this.storage.connect()]);
    }

    async disconnect() {
        return await Promise.all([this.metadata.disconnect(), this.storage.disconnect()]);
    }

    async destroy() {
        return await Promise.all([this.config.destroy(), this.metadata.destroy(), this.storage.destroy()]);
    }
}

module.exports = DB;