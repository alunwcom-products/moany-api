import mysql from 'mysql2/promise';
import logger from './logger.js';
import { compareSync } from "bcrypt-ts";
import dotenv from 'dotenv';
import { generateToken } from './jwt.js';

dotenv.config();

// mysql2 connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // This helps keep the connection alive
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Cast bit(1) fields to boolean
  typeCast: function (field, next) {
    if (field.type === 'BIT' && field.length === 1) {
      const bytes = field.buffer();
      return (bytes[0] === 1);
    } else {
      return next();
    }
  }
});

async function authenticate(username, password) {
  const [results] = await pool.query('select * from users where username = ?', [username]);
  logger.debug(JSON.stringify(results, null, 2));
  const success =
    results.length > 0 &&
    results[0].enabled &&
    results[0].username &&
    results[0].password &&
    results[0].username === username &&
    compareSync(password, results[0].password);

  logger.debug(`Login attempt: user = '${username}' [success = ${success}]`);

  if (success) {
    const token = generateToken(results[0].id, results[0].username);
    logger.debug(`JWT generated: user = '${username}' [token = '${token}']`);
    return token;
  }

  return undefined;
}

const getSystemInfo = async () => {
  const [results] = await pool.query('select * from system_info', []);
  logger.debug(JSON.stringify(results, null, 2));

  return results;
}

const getAccounts = async () => {
  const [results] = await pool.query('select * from accounts', []);
  logger.debug(JSON.stringify(results, null, 2));

  return results;
}

const getAccountSummary = async () => {
  const [results] = await pool.query('select * from account_summary', []);
  logger.debug(JSON.stringify(results, null, 2));

  return results;
}

// row should be supplied as JSON
const setAccount = async (row) => {
  // check if account exists or not - and either insert or update row
  const [resultSet] = await pool.query('select * from accounts where uuid = ?', [row.uuid]);
  //logger.debug(JSON.stringify(resultSet, null, 2));

  if (resultSet.length > 0) {
    // UPDATE
    logger.info(`Updating account ${row.uuid}`);
    const [results] = await pool.execute(
      'update accounts set account_num = ?, name = ?, type = ?, starting_balance = ?, sortcode = ?, active = ? \
       where uuid = ?',
      [row.account_num, row.name, row.type, row.starting_balance, row.sortcode, row.active, row.uuid]);
    //logger.debug(JSON.stringify(results, null, 2));

  } else {
    // INSERT
    logger.info(`Inserting account ${row.uuid}`);
    const [results] = await pool.execute(
      'insert into accounts (uuid, account_num, name, type, starting_balance, sortcode, active) values (?,?,?,?,?,?,?)',
      [row.uuid, row.account_num, row.name, row.type, row.starting_balance, row.sortcode, row.active]);
    //logger.debug(JSON.stringify(results, null, 2));
  }

  return;
}

export {
  authenticate,
  getAccounts,
  getAccountSummary,
  getSystemInfo,
  setAccount,
}
