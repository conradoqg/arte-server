const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const RBAC = require('easy-rbac');
const HTTPError = require('../httpServer/httpError');
const AuthenticationError = require('./authenticationError');
const AuthorizationError = require('./authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const PasswordPolicy = require('password-sheriff').PasswordPolicy;
const format = require('util').format;
const LdapAuth = require('ldapauth-fork');

const JWT_SECRET = process.env.JWT_SECRET || 'development';
const LENGTH_POLICY = new PasswordPolicy({ length: { minLength: 6 } });

/*
    Overall security rules
    superuser - needs to login using user and pass
        can create, edit and delete everything
    user - needs to login using user and pass
        can create buckets, edit and delete their buckets
    grant - needs to login using token
        can do whatever the token allows
    guest - login through LDAP
        can see buckets and artifacts
    anonymous - no login at all
        can see buckets and artifacts
*/
const ROLES_POLICY = {
    anonymous: {
        can: [
            'buckets:read',
            'bucket:read',
            'artifacts:read',
            'artifact:read'
        ]
    },
    guest: {
        can: [
            'buckets:read',
            'bucket:read',
            'artifacts:read',
            'artifact:read'
        ]
    },
    granted: {
        can: [
            'buckets:read',
            'bucket:read',
            'artifacts:read',
            'artifact:read',
            {
                name: 'artifacts:create',
                when: async (params) => {
                    return params.bucket.owner == params.credential.grants.grantor &&       // The grantor is the owner of the bucket
                        params.credential.grants.buckets.includes(params.bucket.name) &&    // The grantor allows that bucket
                        params.credential.grants.artifactsCreate;                           // The grantor allows artifacts creation                        
                }
            },
            {
                name: 'artifact:update',
                when: async (params) => {
                    return params.bucket.owner == params.credential.grants.grantor &&       // The grantor is the owner of the bucket
                        params.credential.grants.buckets.includes(params.bucket.name) &&    // The grantor allows that bucket
                        params.credential.grants.artifactUpdate;                            // The grantor allows artifact updating                        
                }
            },
            {
                name: 'artifact:remove',
                when: async (params) => {
                    return params.bucket.owner == params.credential.grants.grantor &&       // The grantor is the owner of the bucket
                        params.credential.grants.buckets.includes(params.bucket.name) &&    // The grantor allows that bucket
                        params.credential.grants.artifactRemove;                            // The grantor allows artifact removing
                }
            }
        ]
    },
    user: {
        can: [
            {
                name: 'user:read',
                when: async (params) => params.credential.username == params.user.username
            },
            {
                name: 'user:update',
                when: async (params) => params.credential.username == params.user.username
            },
            {
                name: 'user:remove',
                when: async (params) => params.credential.username == params.user.username
            },
            'buckets:read',
            'bucket:read',
            'buckets:create',
            {
                name: 'bucket:*',
                when: async (params) => params.credential.username == params.bucket.owner
            },
            'artifacts:read',
            'artifact:read',
            {
                name: 'artifacts:create',
                when: async (params) => params.credential.username == params.bucket.owner
            },
            {
                name: 'artifact:*',
                when: async (params) => params.credential.username == params.bucket.owner
            },
            'tokens:grants:create'
        ]
    },
    superuser: {
        can: [
            'users:*',
            'user:*',
            'buckets:*',
            'bucket:*',
            'artifacts:*',
            'artifact:*',
            'tokens:*'
        ]
    }
};

class Auth {
    constructor(metadataDB, ldapConfig) {
        this.metadataDB = metadataDB;
        this.ldapConfig = ldapConfig ? (Array.isArray(ldapConfig) ? ldapConfig : [ldapConfig]) : ldapConfig;
        this.rbac = new RBAC(ROLES_POLICY);
    }

    async isUsersEmpty() {
        const usersInfo = await this.metadataDB.getUsersCount();
        return usersInfo == 0;
    }

    async createToken(username, password) {
        if (typeof (username) != 'string') throw new TypeError('The username argument must be a string');
        if (typeof (password) != 'string') throw new TypeError('The password argument must be a string');

        let token = null;

        const userFound = await this.metadataDB.findUserByUsername(username);

        // First, try to authenticate using the user database
        if (userFound && (username == userFound.username && bcrypt.compareSync(password, userFound.password))) {
            token = Auth.signCredential(Auth.createCredential(userFound.username, userFound.roles));
        }

        // Second, try to authenticate using LDAP, if authenticated, use the user information found or a basic information
        if (!token) {
            if (this.ldapConfig) {
                const tries = this.ldapConfig.map(async (config) => {
                    try {
                        await this.authenticateAgainstLDAP(config, username, password);
                        token = Auth.signCredential(Auth.createCredential(userFound ? userFound.username : username, userFound ? userFound.roles : ['guest']));
                    } catch (ex) {
                        console.debug(`Couldn't authenticate using LDAP: ${ex.message}\n ${ex.stack}`);
                    }
                });
                await Promise.all(tries);
            }
        }

        // If it was not authenticated, try to authenticate against the internal user list
        if (!token) {
            throw new AuthenticationError('Invalid username and/or password');
        }

        return token;
    }

    async createGrantToken(req, username, buckets, artifactsCreate, artifactUpdate, artifactRemove) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (username) != 'string') throw new TypeError('The username argument must be a string');
        if (buckets != null & !Array.isArray(buckets)) throw new TypeError('The buckets argument must be an array or null');
        if (typeof (artifactsCreate) != 'boolean') throw new TypeError('The artifactsCreate argument must be a boolean');
        if (typeof (artifactUpdate) != 'boolean') throw new TypeError('The artifactUpdate argument must be a boolean');
        if (typeof (artifactRemove) != 'boolean') throw new TypeError('The artifactRemove argument must be a boolean');

        if (!await this.checkCredential(req.credential, 'tokens:grants:create')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to create a grant`);

        const bucketsFound = await this.metadataDB.findBucketsByOwner(req.credential.username);

        buckets.forEach(bucket => {
            if (!bucketsFound.find(bucketFound => bucketFound.name == bucket)) throw new InvalidOperationError(`Some of the buckets selected to be granted don't belong to the user '${req.credential.username}'`);
        });

        return Auth.signCredential(Auth.createCredential(username, 'granted', {
            grantor: req.credential.username,
            buckets,
            artifactsCreate,
            artifactUpdate,
            artifactRemove
        }));
    }

    async createUser(req, username, password, roles = ['guest']) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (username) != 'string') throw new TypeError('The username argument must be a string');
        if (typeof (password) != 'string') throw new TypeError('The password argument must be a string');

        if (!await this.checkCredential(req.credential, 'users:create')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to create an user`);

        const userFound = await this.metadataDB.findUserByUsername(username);
        if (userFound) throw new InvalidOperationError(`The user '${username}' already exists`);

        if (!LENGTH_POLICY.check(password)) throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));

        return this.metadataDB.createUser({
            username,
            password: bcrypt.hashSync(password, 8),
            roles
        });
    }

    getToken(token) {
        if (typeof (token) != 'string') throw new TypeError('The token argument must be a string');

        let tokenData = null;
        try {
            tokenData = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            throw new HTTPError(403, 'Failed to authenticate token');
        }
        return tokenData;
    }

    async updateUser(req, username, password = null, roles = null) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');
        if (typeof (username) != 'string') throw new TypeError('The username argument must be a string');

        const userFound = await this.metadataDB.findUserByUsername(username);

        if (!userFound) throw new InvalidOperationError(`The user '${username}' doesn't exist`);

        if (!await this.checkCredential(req.credential, 'user:update', { credential: req.credential, user: userFound })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to update the user ${userFound.username}`);

        if (password) {
            if (LENGTH_POLICY.check(password)) userFound.password = bcrypt.hashSync(password, 8);
            else throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));
        }

        if (roles) {
            roles = Array.isArray(roles) ? roles : [roles];
            if (!await this.checkCredential(req.credential, 'user:update:roles', { credential: req.credential, user: userFound })) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to update the user ${userFound.username}`);
            userFound.roles = roles;
        }

        return this.metadataDB.updateUser(userFound);
    }

    async getUsers(req) {
        if (typeof (req) != 'object') throw new TypeError('The req argument must be an object');

        if (!await this.checkCredential(req.credential, 'users:read')) throw new AuthorizationError(`The user '${req.credential.username}' is not authorized to list users`);

        return this.metadataDB.getUsers();        
    }

    async authenticateAgainstLDAP(config, name, password) {
        return new Promise((resolve, reject) => {
            const ldapAuth = new LdapAuth(config);
            ldapAuth.on('error', reject);
            ldapAuth.authenticate(name, password, (err, user) => {
                if (err) reject(err);

                ldapAuth.close((err) => {
                    if (err) reject(err);
                    resolve(user);
                });
            });
        });
    }

    static createCredential(username, roles, grants) {
        roles = (roles ? (Array.isArray(roles) ? roles : [roles]) : []);
        return {
            username,
            roles,
            grants
        };
    }

    static signCredential(credential, firstTime = false) {
        return jwt.sign(credential, JWT_SECRET, { expiresIn: (firstTime ? '5h' : '90d') });
    }

    getFirstTimeToken() {
        // This token can be used after the first time to create new admin users
        return Auth.signCredential(Auth.createCredential('master@tokens.ai', 'superuser'), true);
    }

    async checkCredential(credential, role, params) {
        return this.rbac.can(credential.roles, role, params);
    }

    static extractAuthenticationFromReq(req) {
        let token = null;
        if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) token = req.headers['authorization'];
        else if (req.cookies && req.cookies.authorization) token = req.cookies.authorization;

        return token;
    }

    createMiddleware(required = true) {
        return (req, res, next) => {
            const token = Auth.extractAuthenticationFromReq(req);

            req.credential = Auth.createCredential('anonymous', ['anonymous']);

            if (token) {
                try {
                    req.credential = this.getToken(token);
                } catch (ex) {
                    if (req.accepts('html') && required) res.redirect('/login');
                    else next(ex);
                }
            } else if (required) {
                if (req.accepts('html')) res.redirect('/login');
                throw next(new HTTPError(401, 'Authorization header missing'));
            }
            next();
        };
    }
}

module.exports = Auth;