const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const HTTPError = require('../httpServer/httpError');
const AuthenticationError = require('./authenticationError');
const AuthorizationError = require('./authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const PasswordPolicy = require('password-sheriff').PasswordPolicy;
const format = require('util').format;
const LdapAuth = require('ldapauth-fork');

const JWT_SECRET = process.env.JWT_SECRET || 'development';
const LENGTH_POLICY = new PasswordPolicy({ length: { minLength: 6 } });

class Auth {
    constructor(metadataDB, ldapConfig) {
        this.metadataDB = metadataDB;
        this.ldapConfig = ldapConfig ? (Array.isArray(ldapConfig) ? ldapConfig : [ldapConfig]) : ldapConfig;
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

    async getFirstTimeToken() {
        // This token can be used after the first time to create new admin users
        return jwt.sign({ username: 'master@tokens.ai', type: 'admin' }, JWT_SECRET, { expiresIn: '5h' });
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
                    token = jwt.sign({ username: userFound ? userFound.username : username, type: userFound ? userFound.type : 'user' }, JWT_SECRET, { expiresIn: '1d' });
                } catch (ex) {
                    console.debug(`Couldn't authenticate using LDAP: ${ex.message}\n ${ex.stack}`);
                }
            });
            await Promise.all(tries);
        }

        // If it was not authenticated, try to authenticate against the internal user list
        if (!token) {
            if (userFound && (username == userFound.username && bcrypt.compareSync(password, userFound.password))) {
                token = jwt.sign({ username: userFound.username, type: userFound.type }, JWT_SECRET, { expiresIn: '1d' });
            } else {
                throw new AuthenticationError('Invalid username and/or password');
            }
        }

        return token;
    }

    async createUser(user = null, username, password, type) {
        const userFound = await this.metadataDB.findUserByUsername(username);

        if (userFound) throw new InvalidOperationError(`The user '${username}' already exists`);

        if (type && type == 'admin' && user && user.type != 'admin') throw new AuthorizationError(`The user '${user.username}' is not authorized to create an admin user`);

        if (this.ldapConfig && (!user || user.type != 'admin')) throw new InvalidOperationError('Cannot create regular users if LDAP is active');

        if (!LENGTH_POLICY.check(password)) throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));

        return this.metadataDB.createUser({
            username,
            password: bcrypt.hashSync(password, 8),
            type: type || 'user'
        });
    }

    async updateUser(user, username, password = null, type = null) {
        const userFound = await this.metadataDB.findUserByUsername(username);

        if (userFound) {
            if (password != null) {
                if (user.username == username) {
                    if (LENGTH_POLICY.check(password)) userFound.password = bcrypt.hashSync(password, 8);
                    else throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));
                } else throw new AuthorizationError(`The user '${user.username}' is not authorized to update user '${username}'`);
            }

            if (type != null) {
                if (user.type == 'admin') userFound.type = type;
                else throw new AuthorizationError(`The user '${user.username}' is not authorized to update user '${username}'`);
            }

            return this.metadataDB.updateUser(userFound);
        } else {
            throw new InvalidOperationError(`The user '${username}' doesn't exist`);
        }
    }

    async getUsers(user) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.username}' is not authorized to list users`);

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