import mysql from 'mysql2/promise';
import logger from './logger.js';
import { compareSync } from "bcrypt";
import { generateToken } from './jwt.js';

import 'dotenv/config';

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
  const success =
    results.length > 0 &&
    results[0].enabled &&
    results[0].username &&
    results[0].password &&
    results[0].username === username &&
    compareSync(password, results[0].password);

  if (success) {
    const token = generateToken(results[0].id, results[0].username);
    return token;
  }
  return undefined;
}

const getSystemInfo = async () => {
  const [results] = await pool.query('select * from system_info', []);
  return results;
}

const getAccounts = async () => {
  const [results] = await pool.query('select * from accounts', []);
  return results;
}

const getAccountSummary = async () => {
  const [results] = await pool.query('select * from account_summary', []);
  return results;
}

// row should be supplied as JSON
const setAccount = async (row) => {
  // check if account exists or not - and either insert or update row
  const [resultSet] = await pool.query('select * from accounts where uuid = ?', [row.uuid]);

  if (resultSet.length > 0) {
    // UPDATE
    logger.debug(`Updating account ${row.uuid}`);
    const [results] = await pool.execute(
      'update accounts set account_num = ?, name = ?, type = ?, starting_balance = ?, sortcode = ?, active = ? \
       where uuid = ?',
      [row.account_num, row.name, row.type, row.starting_balance, row.sortcode, row.active, row.uuid]);
  } else {
    // INSERT
    logger.debug(`Inserting account ${row.uuid}`);
    const [results] = await pool.execute(
      'insert into accounts (uuid, account_num, name, type, starting_balance, sortcode, active) values (?,?,?,?,?,?,?)',
      [row.uuid, row.account_num, row.name, row.type, row.starting_balance, row.sortcode, row.active]);
  }
  return;
}

async function getAccountByNumber(accountNumStr) {
  try {
    const query = 'SELECT uuid, account_num, name, type, starting_balance FROM accounts WHERE account_num = ?';
    const [results, fields] = await pool.query(
      query, [accountNumStr]
    );
    if (results.length !== 1) {
      throw new Error(`No matching account found for '${accountNumStr}'!`);
    }
    return results[0];

  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function getAccountByUuid(uuid) {
  try {
    const query = 'SELECT * FROM accounts WHERE uuid = ?';
    const [results, fields] = await pool.query(
      query, [uuid]
    );
    if (results.length !== 1) {
      throw new Error(`No matching account found for '${uuid}'!`);
    }
    return results[0];

  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function storeTransactions(transactions) {
  try {
    const query = 'INSERT INTO transactions (uuid, statement_amount, description, comment, entry_date,\
    source_name, source_row, source_type, statement_balance, account_balance, trans_date, type, account,\
    category, net_amount) VALUES ?';

    const values = transactions.map((row) => [
      row.uuid,
      row.statement_amount,
      row.description,
      row.comment,
      row.entry_date,
      row.source_name,
      row.source_row,
      row.source_type,
      row.statement_balance,
      row.account_balance,
      row.trans_date,
      row.type,
      row.account,
      row.category,
      row.net_amount
    ]);

    // bulk insert doesn't work with 'execute()'! https://github.com/sidorares/node-mysql2/issues/830
    const [results] = await pool.query(
      query, [values]
    );

    logger.info(`Transactions inserted: ${results.affectedRows}`);

    return results.affectedRows;

  } catch (error) {
    logger.error(error);
    throw error;
  }
}

// expecting autocommit = off for this - to allow locking and rollback, but works either way
async function calculateAccountBalances(account) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('BEGIN');

    const query = 'SELECT * FROM transactions WHERE account = ? ORDER BY trans_date, source_row FOR UPDATE';
    const [rows, fields] = await conn.query(
      query, [account.uuid]
    );

    if (account.type !== 'DEBIT' && account.type !== 'CREDIT') {
      throw new Error(`Account type not valid [${account.uuid}]!`);
    }
    const multiplier = (account.type === 'DEBIT' ? 1 : -1);
    let account_balance = parseFloat(account.starting_balance);

    for (const row of rows) {
      const updatedRow = { ...row };

      // calculate net_amount
      // need to handle cases where statement_amount is not defined (must have either statement_amount or net_amount)
      let net_amount = 0;
      if (row.statement_amount && row.statement_amount.length > 0) {
        net_amount = parseFloat(row.statement_amount) * multiplier;
      }
      if (row.net_amount && row.net_amount.length > 0) {
        net_amount = parseFloat(row.net_amount);
      }
      updatedRow.net_amount = net_amount;

      // calculate account_balance
      account_balance += net_amount;
      updatedRow.account_balance = account_balance;

      logger.debug(`${updatedRow.statement_amount} | ${updatedRow.statement_balance} | ${updatedRow.net_amount} | ${updatedRow.account_balance}`);

      // save transaction
      const query = 'UPDATE transactions SET net_amount = ?, account_balance = ?  WHERE uuid = ?';
      const [rows, fields] = await conn.query(
        query, [updatedRow.net_amount, updatedRow.account_balance, updatedRow.uuid]
      );
    }

    await conn.query('COMMIT');

  } catch (error) {
    await conn.query('ROLLBACK');
    logger.error(error);
    throw error;
  } finally {
    conn.release();
  }
}

export {
  authenticate,
  calculateAccountBalances,
  getAccountByNumber,
  getAccountByUuid,
  getAccounts,
  getAccountSummary,
  getSystemInfo,
  setAccount,
  storeTransactions,
}
