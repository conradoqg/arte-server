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
const ROLES_POLICY = {
    bucketCreator: {
        can: [
            'buckets:create'
        ]
    },
    bucketOwner: {
        can: [
            {
                name: 'bucket:*',
                when: async (params) => params.credential.username == params.bucket.owner
            },
            {
                name: 'artifact:*',
                when: async (params) => params.credential.username == params.bucket.owner
            }
        ]
    },
    artifactGranted: {
        can: [
            'artifacts:create',
            {
                name: 'artifact:*',
                when: async (params) => params.artifact.isSubSet(params.credential.grants)
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
            }
        ],
        inherits: ['bucketCreator', 'bucketOwner']
    },
    superuser: {
        can: [
            'users:*',
            'user:*',
            'buckets:*',
            'bucket:*',
            'artifacts:*',
            'artifact:*'
        ]
    }
};

/*
    Overall security rules
    superuser - needs to login using user and pass
        can create, edit and delete everything
    user - needs to login using user and pass
        can create buckets, edit and delete their buckets
    api - needs to login using token
        can do whatever the token allows
    guest - don't need to login
        can see public buckets

    Token (from login)
        user:  user        
        roles:
            

    API Key (manually generated)
        user
        roles: 
*/

class Auth {
    constructor(metadataDB, ldapConfig) {
        this.metadataDB = metadataDB;
        this.ldapConfig = ldapConfig ? (Array.isArray(ldapConfig) ? ldapConfig : [ldapConfig]) : ldapConfig;
        this.rbac = new RBAC(ROLES_POLICY);
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

    async isUsersEmpty() {
        const usersInfo = await this.metadataDB.getUsersCount();
        return usersInfo == 0;
    }

    static createTokenObject(username, roles, grants) {
        roles = (roles ? (Array.isArray(roles) ? roles : [roles]) : []);
        return {
            username,
            roles,
            grants
        };
    }

    async getFirstTimeToken() {
        // This token can be used after the first time to create new admin users
        return jwt.sign(Auth.createTokenObject('master@tokens.ai', 'superuser'), JWT_SECRET, { expiresIn: '5h' });
    }

    async createToken(username, password) {
        let token = null;

        const userFound = await this.metadataDB.findUserByUsername(username);

        // Fist, try to authenticate using LDAP, if authenticated, use the user information found or a basic information
        if (this.ldapConfig) {
            const tries = this.ldapConfig.map(async (config) => {
                try {
                    await this.authenticateAgainstLDAP(config, username, password);
                    // TODO: Maybe the token content should be a projection of the user model?
                    token = jwt.sign(Auth.createTokenObject(userFound ? userFound.username : username, userFound ? userFound.roles : ['guest']), JWT_SECRET, { expiresIn: '1d' });
                } catch (ex) {
                    console.debug(`Couldn't authenticate using LDAP: ${ex.message}\n ${ex.stack}`);
                }
            });
            await Promise.all(tries);
        }

        // If it was not authenticated, try to authenticate against the internal user list
        if (!token) {
            if (userFound && (username == userFound.username && bcrypt.compareSync(password, userFound.password))) {
                token = jwt.sign(Auth.createTokenObject(userFound.username, userFound.roles), JWT_SECRET, { expiresIn: '1d' });
            } else {
                throw new AuthenticationError('Invalid username and/or password');
            }
        }

        return token;
    }

    async createUser(credential, username, password, roles = ['guest']) {
        if (!await this.rbac.can(credential.roles, 'users:create')) throw new AuthorizationError(`The user '${credential.username}' is not authorized to create an user`);

        const userFound = await this.metadataDB.findUserByUsername(username);
        if (userFound) throw new InvalidOperationError(`The user '${username}' already exists`);

        if (!LENGTH_POLICY.check(password)) throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));

        return this.metadataDB.createUser({
            username,
            password: bcrypt.hashSync(password, 8),
            roles
        });
    }

    async updateUser(credential, username, password = null, roles = null) {
        const userFound = await this.metadataDB.findUserByUsername(username);

        if (!userFound) throw new InvalidOperationError(`The user '${username}' doesn't exist`);

        if (!await this.rbac.can(credential.roles, 'user:update', { credential, user: userFound })) throw new AuthorizationError(`The user '${credential.username}' is not authorized to update the user ${userFound.username}`);

        if (password) {
            if (LENGTH_POLICY.check(password)) userFound.password = bcrypt.hashSync(password, 8);
            else throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));
        }

        if (roles) {
            roles = Array.isArray(roles) ? roles : [roles];
            if (!await this.rbac.can(credential.roles, 'user:update:roles', { credential, user: userFound })) throw new AuthorizationError(`The user '${credential.username}' is not authorized to update the user ${userFound.username}`);
            userFound.roles = roles;
        }

        return this.metadataDB.updateUser(userFound);
    }

    async getUsers(credential) {
        if (!await this.rbac.can(credential.roles, 'users:read')) throw new AuthorizationError(`The user '${credential.username}' is not authorized to list users`);        

        const users = await this.metadataDB.getUsers();
        return users;
    }

    createMiddleware(required = true) {
        return (req, res, next) => {
            if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
                try {
                    req.user = jwt.verify(req.headers['authorization'], JWT_SECRET);
                } catch (err) {
                    throw new HTTPError(403, 'Failed to authenticate token');
                }
            } else if (required) {
                throw new HTTPError(401, 'Authorization header missing');
            }
            next();
        };
    }
}

module.exports = Auth;