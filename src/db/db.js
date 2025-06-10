import mysql from 'mysql2/promise';
import logger from './logger.js';
import { compareSync } from "bcrypt-ts";
import dotenv from 'dotenv';
import { generateToken } from './jwt.js';

dotenv.config();

// MySQL connection configuration using environment variables
const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // Cast bit(1) fields to boolean
    typeCast: function (field, next) {
        if (field.type === 'BIT' && field.length === 1) {
            const bytes = field.buffer();
            return ( bytes[ 0 ] === 1 );
        } else {
            return next();
        }
    }
});

async function authenticate(username, password) {
    const [ results ] = await connection.query('select * from users where username = ?', [username]);
    logger.info(JSON.stringify(results, null, 2));
    const success = 
        results.length > 0 &&
        results[0].enabled &&
        results[0].username &&
        results[0].password &&
        results[0].username === username &&
        compareSync(password, results[0].password);

    logger.info(`Login attempt: user = '${username}' [success = ${success}]`);

    if (success) {
        const token = generateToken(results[0].id, results[0].username);
        logger.info(`JWT generated: user = '${username}' [token = '${token}']`);
        return { 
            success: true,
            token: token
        };
    }

    return { success: false };
}

const getAccounts = async () => {
    const [ results ] = await connection.query('select * from accounts', []);
    logger.debug(JSON.stringify(results, null, 2));

    return results;
}

export {
    authenticate,
    getAccounts
 }
