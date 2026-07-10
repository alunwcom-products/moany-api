import mysql from 'mysql2/promise';
import logger from './logger.js';
import { compareSync } from "bcrypt";
import { getKey } from './utils.js';
import dayjs from 'dayjs';

import 'dotenv/config';
import { formatDate, getYearMonthRange } from './date.js';

// mysql2 connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // decimalNumbers: true,
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
  if (results.length === 0) {
    // username not found
    logger.warn(`Authentication failed: user '${username}' not found`);
    return undefined;
  }

  if (results.length > 1) {
    // multiple matching usernames??
    logger.warn(`Authentication failed: multiple matching username records found for '${username}'`);
    return undefined;
  }

  // is valid and matching username and password?
  const success =
    results.length > 0 &&
    results[0].enabled &&
    results[0].username &&
    results[0].password &&
    results[0].username === username &&
    compareSync(password, results[0].password);

  return success ? results[0] : undefined;
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

// used as lookup - no pagination
const getCategories = async () => {
  const [results] = await pool.query('SELECT * FROM categories_view ORDER BY full_name', []);
  return results;
}

// row should be supplied as JSON (uuid, name, parent_id)
// returns new category
const setCategory = async (row) => {
  // validate category - only name required
  if (!row.name) throw new Error('Category name missing.');

  // check if parent_id is set, if not set value as null
  if (row.parent_id === '') {
    row.parent_id = null;
  }

  // check parent_id is not equal to uuid
  if (row.uuid && row.uuid === row.parent_id) {
    throw new Error('UUID cannot be same as parent UUID');
  }

  if (!row.uuid) {
    // insert new category

    row.uuid = getKey();

    // don't set entry_date, created or modified - these will be set in database!
    const [results] = await pool.execute(
      'INSERT INTO categories (uuid, name, parent_id) VALUES (?,?,?)',
      [
        row.uuid ?? null,
        row.name ?? null,
        row.parent_id ?? null,
      ]);

    if (results.affectedRows !== 1) {
      // No category inserted
      throw new Error("Category insert failed");
    }

    logger.debug(`Inserted category: ${row.uuid}`);

  } else {
    // update existing transaction

    const [results] = await pool.execute(
      'UPDATE categories SET name = ?, parent_id = ? WHERE uuid = ?',
      [
        row.name ?? null,
        row.parent_id ?? null,
        row.uuid ?? null,
      ]);

    if (results.affectedRows === 0) {
      // No matching category
      throw new Error("No matching category");
    }

    logger.debug(`Updated category: ${row.uuid}`);
  }

  const [results] = await pool.query('SELECT * FROM categories WHERE uuid = ?', [row.uuid]);
  return results[0];
}

const getTransactions = async (limit, offset, accounts, categories, includeChildCategories, startDate, endDate) => {

  // base query params
  let whereSql = ' WHERE 1=1';
  const params = [];

  // handle accounts
  if (accounts && accounts.length > 0) {
    whereSql += ' AND account IN (?)';
    params.push(accounts);
  }

  // handle categories + include child categories
  if (categories && categories.length > 0) {

    // check for null (Uncategorized) category
    const uncat = categories.filter((uuid) => uuid === 'null');
    if (uncat.length === 0) {
      whereSql += ' AND category IN ';
    } else {
      whereSql += ' AND category IS NULL OR category IN ';
    }

    // check for 'include child categories'
    if (includeChildCategories === 'true' || includeChildCategories === true) {
      // look up the category itself AND all its descendants
      whereSql += '(SELECT descendant_id FROM v_category_hierarchy WHERE parent_id IN (?))';
    } else {
      // only match exact categories
      whereSql += '(?)';
    }
    params.push(categories);
  }

  // handle Dates
  if (startDate) {
    whereSql += ' AND trans_date >= ?';
    params.push(formatDate(startDate));
  }
  if (endDate) {
    whereSql += ' AND trans_date <= ?';
    params.push(formatDate(endDate));
  }

  const transactionsParams = [accounts, formatDate(startDate), formatDate(endDate), limit, offset];

  // get total count (for frontend pagination controls)
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM transactions ${whereSql}`,
    params
  );
  const totalItems = countResult[0].total;

  // get paginated data
  // NOTE: params are reused, then we add LIMIT and OFFSET
  let dataSql = `SELECT * FROM transactions ${whereSql} ORDER BY trans_date, account, source_row, uuid LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(dataSql, [...params, limit, offset]);

  // reformat trans_date
  const resultsDateFormat = rows.map((row) => ({
    ...row,
    trans_date: dayjs(row.trans_date).format('YYYY-MM-DD')
  }));

  return {
    results: resultsDateFormat,
    totalCount: Number(totalItems),
    resultCount: resultsDateFormat.length,
    offset,
    limit,
  };
}

const getTransactionsDateRange = async () => {
  const [results] = await pool.query('select min(trans_date) as min_date, max(trans_date) as max_date from transactions', []);
  return results[0];
}

const getMonthlyTotals = async () => {
  const [results] = await pool.query('select * from monthly_totals', []);

  // convert the yearmonth to the last day of each month
  const dateResults = results.map((row) => {
    const newRow = row;
    const yearmonth = new String(newRow.yearmonth); // convert number to string

    if (yearmonth.length !== 6) {
      throw new Error(`Invalid yearmonth in monthly_totals [${row.yearmonth}]`);
    }

    const year = parseInt(yearmonth.substring(0, 4));
    const month = parseInt(yearmonth.substring(4, 6));

    const lastDayTimestamp = Date.UTC(year, month, 0);
    const lastDay = new Date(lastDayTimestamp);

    newRow.enddate = lastDay;
    return newRow;
  });

  return dateResults;
}

const getCategoryTotals = async (startMonth, endMonth) => {
  logger.debug(`start = ${startMonth}; end = ${endMonth}`);
  const range = getYearMonthRange(startMonth, endMonth).map((item) => {
    return { [item]: null };
  });

  const [results] = await pool.query('SELECT * FROM v_monthly_category_totals WHERE month BETWEEN ? AND ? ORDER BY full_name, month', [startMonth, endMonth]);

  // pivot data
  const pivoted = results.reduce((acc, { uuid, full_name, name, depth, month, total_amount }) => {
    // Look for an existing object for this category
    let category = acc.find(item => item.uuid === uuid);

    if (!category) {
      // If it doesn't exist, create it and push to accumulator
      category = { uuid, full_name, name, depth };
      Object.assign(category, ...range);
      acc.push(category);
    }
    category[month] = total_amount;

    return acc;
  }, []);

  return pivoted;
}

// row should be supplied as JSON
const setAccount = async (row) => {

  // validate account
  if (!row.account_num) throw new Error('Account number missing.');
  if (!row.name) throw new Error('Account name missing.');
  if (row.type && row.type !== 'DEBIT' && row.type !== 'CREDIT') throw new Error('Invalid account type.');

  if (!row.uuid) {
    // insert new account
    row.uuid = getKey();

    const [results] = await pool.execute(
      'insert into accounts (uuid, account_num, name, type, starting_balance, sortcode, active) values (?,?,?,?,?,?,?)',
      [
        row.uuid, // required (getKey())
        row.account_num, // required
        row.name, //required
        row.type ?? 'DEBIT', // default to 'DEBIT' ['DEBIT', 'CREDIT']
        row.starting_balance ?? 0, // default to zero
        row.sortcode ?? null, // default to null
        row.active ?? true // default to active `b'1'`
      ]);

    if (results.affectedRows !== 1) {
      throw new Error("Account insert failed");
    }

    logger.debug(`Inserted account: ${row.uuid}`);

  } else {
    // update existing account


    const [results] = await pool.execute(
      'update accounts set account_num = ?, name = ?, type = ?, starting_balance = ?, sortcode = ?, active = ? where uuid = ?',
      [
        row.account_num, // required 
        row.name, // required
        row.type ?? 'DEBIT', // default to 'DEBIT' ['DEBIT', 'CREDIT']
        row.starting_balance ?? 0, // default to zero
        row.sortcode ?? null, // default to null
        row.active ?? true, // default to active `b'1'`
        row.uuid // required
      ]);

    if (results.affectedRows === 0) {
      throw new Error("No matching account");
    }

    logger.debug(`Updated account: ${row.uuid}`);
  }

  // NOTE: returning account summary record - which has additional properties to the account record
  const [results] = await pool.query('SELECT * FROM account_summary WHERE uuid = ?', [row.uuid]);
  return results[0];
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

// insert/update transaction (dependent on whether uuid is set)
const setTransaction = async (row) => {

  // validate transaction
  if (!row.account) throw new Error('Account missing.');
  // if (!row.net_amount) throw new Error('Net amount missing.'); // zero value fails this test, should make 0 database default
  if (!row.trans_date) throw new Error('Transaction date missing.');
  if (!row.source_type) throw new Error('Source type missing.');

  if (!row.uuid) {
    // insert new transaction
    row.uuid = getKey();

    // don't set entry_date, created or modified - these will be set in database!
    const [results] = await pool.execute(
      'insert into transactions (uuid, statement_amount, description, comment, source_name, \
       source_row, source_type, statement_balance, account_balance, trans_date, type, account, category, \
       net_amount) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        row.uuid ?? null,
        row.statement_amount ?? null,
        row.description ?? null,
        row.comment ?? null,
        row.source_name ?? null,
        row.source_row ?? 0,
        row.source_type ?? null,
        row.statement_balance ?? null,
        row.account_balance ?? null,
        row.trans_date ?? null,
        row.type ?? null,
        row.account ?? null,
        row.category ?? null,
        row.net_amount ?? null
      ]);

    if (results.affectedRows !== 1) {
      // No category inserted
      throw new Error("Transaction insert failed");
    }

    logger.debug(`Inserted transaction: ${row.uuid}`);

  } else {
    // update existing transaction

    const [results] = await pool.execute(
      'update transactions set \
       statement_amount = ?, description = ?, comment = ?, \
       source_name = ?, source_row = ?, source_type = ?, statement_balance = ?, \
       account_balance = ?, trans_date = ?, type = ?, account = ?, category = ?, \
       net_amount = ? where uuid = ?',
      [
        row.statement_amount ?? null,
        row.description ?? null,
        row.comment ?? null,
        row.source_name ?? null,
        row.source_row ?? null,
        row.source_type ?? null,
        row.statement_balance ?? null,
        row.account_balance ?? null,
        row.trans_date ?? null,
        row.type ?? null,
        row.account ?? null,
        row.category ?? null,
        row.net_amount ?? null,
        row.uuid
      ]);

    if (results.affectedRows === 0) {
      // No matching category
      throw new Error("No matching transaction");
    }

    logger.debug(`Updated transaction: ${row.uuid}`);
  }

  const [results] = await pool.query('SELECT * FROM transactions WHERE uuid = ?', [row.uuid]);
  return results[0];
};

async function storeTransactions(transactions) {

  logger.debug(`storeTransactions() called [count = ${transactions.length}]`);

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

    logger.debug('storeTransactions() completed successfully');

    return results.affectedRows;

  } catch (error) {
    logger.error(error);
    throw error;
  }
}

// if no account is supplied, all accounts will be re-balanced
async function calculateAccountBalances(account) {
  let conn;
  try {
    await pool.query('call sp_recalculate_balances()', []);
    logger.info(`calculateAccountBalances('${account}') called`);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export {
  authenticate,
  calculateAccountBalances,
  getAccountByNumber,
  getAccountByUuid,
  getAccounts,
  getAccountSummary,
  getCategories,
  getCategoryTotals,
  getMonthlyTotals,
  getSystemInfo,
  getTransactionsDateRange,
  getTransactions,
  setAccount,
  setCategory,
  setTransaction,
  storeTransactions,
}
