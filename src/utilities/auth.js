import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import 'dotenv/config';

import logger from './logger.js';
import { findUserByUsername } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION_TIME = process.env.JWT_EXPIRATION_TIME || '15m'; // For initial token and refreshed token

if (!JWT_SECRET) {
    logger.error('ERROR: JWT_SECRET is not set in environment variables or .env file!');
    process.exit(1);
}

// internal only functions
async function generateJWT(id, username) {
    const payload = { userId: id, username: username };
    try {
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION_TIME });
        logger.info(`JWT generated: ${token}`);
        return token;
    } catch (err) {
        logger.error('Error generating JWT:', err);
        throw err;
    }
}

async function verifyJWT(token) {
    try {
        var payload = jwt.verify(token, JWT_SECRET);
        logger.debug(`Valid token: ${payload}`);
        return payload;
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            logger.error('Token expired');
        } else {
            logger.error('Invalid token: ', err);
        }
        throw err;
    }
}

async function authenticate(username, password) {
    try {
        const user = await findUserByUsername(username);
        if (!user) {
            logger.warn(`User not found: ${username}`);
            return null;
        }

        if (!user) {
            logger.warn(`User disabled: ${username}`);
            return null;
        }

        // Authenticate
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            logger.warn(`Login failed for username: ${username} - Incorrect password.`);
            return null;
        }

        logger.info(`User ${username} authenticated.`);

        const token = await generateJWT(user);
        return token

    } catch (error) {
        logger.error('Error during authentication: ', error);
    }
    return null;
}

export {
    generateJWT,
    verifyJWT,
    authenticate
};
