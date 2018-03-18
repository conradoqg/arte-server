const fs = require('fs-extra');
const path = require('path');

const defaultConfig = {
    development: {        
        storageDB: 'data/storage',
        metadataDB: 'mongodb://localhost/arte-server'
    }
};

class ConfigDB {
    constructor(path) {
        this.path = path;

        this.createInitialConfigIfNotFound();
    }

    createInitialConfigIfNotFound() {
        fs.ensureDirSync(path.dirname(this.path));
        if (!fs.existsSync(this.path)) fs.writeFileSync(this.path, JSON.stringify(defaultConfig, null, 2));
    }

    async updateConfig(config) {
        const originalConfig = JSON.parse(await fs.readFile(this.path, 'utf-8'));
        originalConfig[process.env.NODE_ENV] = config;
        await fs.writeFile(this.path, JSON.stringify(originalConfig, null, 2));
        return config;
    }

    async getConfig() {
        return JSON.parse(await fs.readFile(this.path, 'utf-8'))[process.env.NODE_ENV];
    }

    async disconnect() {
    }

    async destroy() {
        return (await fs.exists(this.path) ? await fs.unlink(this.path) : null);
    }
}

module.exports = ConfigDB;