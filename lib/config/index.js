class Config {
    constructor(mongoURL, storagePath) {
        this.mongoURL = mongoURL;
        this.storagePath = storagePath;        
    }    
}

module.exports = Config;