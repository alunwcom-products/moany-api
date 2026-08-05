/*

statements can be parsed and then represented as an array of transactions (see below) for review and committing to database:

uuid - generated
statement_amount - transaction amount as it appears on bank statement
description - transaction description
comment - 'NULL' (added later manually as required)
entry_date - date/time inserted to database (should really have been 'TIMESTAMP' not 'DATETIME')
source_name - statement filename derived from upload
source_row - sequential row number from statement (to ensure order remains same as statements when transaction dates are the same)
source_type - 'STATEMENT' (this may have been better defined as 'enum' data type)
statement_balance - balance amount as it appear on bank statement (this may be null)
account_balance - calculated balance using account_amount
trans_date - transaction date
type - transaction type (if this appears on statement)
account - uuid linking transaction to an account
category - 'NULL' (added later manually as required)
net_amount - calculated amount such that incoming amounts are positive and outgoing amounts are negative

if there are any errors while parsing - these will be thrown (not caught).
if the error is a result of internal validation an error message should be given.

*/

import { isValid, parse } from "date-fns";
import { getKey } from "../lib/utils.js";
import logger from "../lib/logger.js";
import { getAccountByNumber } from "../lib/db.js";

const TX_AMOUNT_REGEX = / ?\d{1,3}(?:,\d{3})*\.\d{2}$/; // used to check for the end of a transaction line

export default async function parseStatement(pdfText, pdfFilename) {
  logger.debug('start parseTransactions()');
  const transactions = parseTransactions(pdfText, pdfFilename);
  logger.debug('completed parseTransactions()');
  return transactions;
}


async function parseTransactions(pdfText, pdfFilename) {

  // Before actually parsing the transactions, the statement next needs to be processed
  // to remove much of the non-transaction text which would prevent transactions being
  // parsed corrected.
  // This is done by removing the 'pre-transaction' text, then the 'post-transaction'
  // text, and lastly any text that appears as headers and footers between pages.
  // The text is initially split into an array of lines to assist processing, and allow
  // multiline transactions to subsequently be merged together.

  // Split text into array of lines (removing leading/trailing whitespace, empty lines)
  const rawLines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Remove text before first transaction (i.e. before first 'BROUGHT FORWARD' line)
  let skipLines = true;
  const editedText1 = rawLines.filter(line => {
    if (!skipLines) return true;
    if (line.toUpperCase().includes('BROUGHT FORWARD')) {
      skipLines = false;
      return true;
    }
    return false;
  });

  // Remove text after last transaction balance (i.e. currency amount at end of line) NOTE: working from end to beginning
  skipLines = true;
  const editedText2 = editedText1.toReversed().filter(line => {
    if (!skipLines) return true;
    if (TX_AMOUNT_REGEX.test(line)) { // relies on only transaction lines ending currency format without £
      skipLines = false;
      return true;
    }
    return false;
  });

  // Remove text between pages (i.e. lines from 'RETSTMT' to 'Balance(£)') NOTE: re-reverse the order
  skipLines = false;
  const editedText3 = editedText2.toReversed().filter(line => {
    // Check if transactions ended for page
    if (line.startsWith('RETSTMT')) {
      skipLines = true;
      return false;
    }
    if (skipLines && line.endsWith('Balance(£)')) {
      skipLines = false;
      return false;
    }
    if (skipLines) return false;
    // else
    return true;
  });

  // merge multi-line transactions
  const txLines = mergeTransactions(editedText3);

  // logger.debug(JSON.stringify(txLines, null, 2));

  // get account so account uuid can be added to transactions
  const account = await getAccountByNumber(getAccountNumber(pdfText));

  // parse transaction details and add to output array to be returned
  const txRegex = /^(?<date>\d{2}\s+[A-Z]{3}(?:\s+\d{4})?)?(?:\s*(?<description>.*?))(?:\s+?(?<amount>-?(?:0|[1-9]\d{0,2}(?:,\d{3})*|\d+)\.\d{2}))?\s+?(?<balance>-?(?:0|[1-9]\d{0,2}(?:,\d{3})*|\d+)\.\d{2})$/;
  
  const txs = [];
  let lastDate; // store last date for transactions without date
  let previousBalance; // track balance to see if transaction amount is positive or negative (credit or debit)
  let sourceRow = 0; // counter for sequence of transactions on statement

  txLines.forEach(tx => {

    const match = txRegex.exec(tx);
    const { date, description, amount, balance } = match.groups;

    // get transaction date
    lastDate = getTransactionDate(date, lastDate);
 
    // get balance value
    const statement_balance = getAmountFromString(balance);

    // calculate whether amount is debit or credit (all show as positive values on statement)
    let statement_amount;
    if (amount) {
      statement_amount = getAmountFromString(amount);
      // need to check if this is paid in or withdrawn
      if (!previousBalance) {
        // first transaction is b/f balance - can ignore this
      } else if (previousBalance > statement_balance) {
        statement_amount = statement_amount * -1;
      }
    } else {
      statement_amount = 0;
    }

    // update previous balance
    previousBalance = statement_balance;

    // net amount will always equal statement amount (this has not always been the case when statements were imported as CSV data)
    const net_amount = statement_amount;

    // add transaction to output array
    txs.push({
      uuid: getKey(),
      statement_amount,
      description,
      comment: null,
      entry_date: new Date(),
      source_name: pdfFilename,
      source_row: ++sourceRow,
      source_type: 'STATEMENT',
      statement_balance,
      account_balance: null,
      trans_date: lastDate,
      type: null,
      account: account.uuid,
      category: null,
      net_amount
    });
  });

  // sort on transaction date and source row (mastercard payment is not shown in order on statement)
  txs.sort((a, b) => a.trans_date - b.trans_date || a.sourceRow - b.sourceRow);  

  // logger.debug(JSON.stringify(txs, null, 2));

  return txs;
}

// Merge multiline transactions
function mergeTransactions(txLines) {
  const mergedTxLines = []; // output array
  let multilineStr = null;

  txLines.forEach(txLine => {
    if (multilineStr != null) { // multi-line transaction started
      if (/^\d{2} [A-Z]{3} /.test(txLine)) { // starts with date - invalid state
        logger.error(`Unexpected multi-line tx state: '${txLine}'`);
      } else {
        if (TX_AMOUNT_REGEX.test(txLine)) { // ends with amount - must be end of multi-line tx
          multilineStr += ` ${txLine}`;
          mergedTxLines.push(multilineStr);
          multilineStr = null;
        } else { // no amount - must be middle of multi-line tx
          logger.debug(`mid tx: ${txLine}`);
          multilineStr += ` ${txLine}`;
        }
      }
    } else {
      if (TX_AMOUNT_REGEX.test(txLine)) { // ends with amount - must be single line transaction (with or without date at start of line)
        mergedTxLines.push(txLine);
      } else {
        multilineStr = txLine;
      }
    }
  });

  return mergedTxLines;
}

// TODO parse amounts - use currency type?
function getAmountFromString(amountStr, signStr = '') {
  const sign = (signStr.trim() === '-' ? '-' : '+');
  return parseFloat(sign + amountStr.trim().replaceAll(',', ''));
}

// get account number from statement
// format: '87275643 60-01-04'
function getAccountNumber(text) {
  const regex = /(?<accountNumber>\d{8})\s(?<sortCode>\d{2}-\d{2}-\d{2})/;
  const match = regex.exec(text);
  const { accountNumber, sortCode } = match.groups;
  if (!accountNumber) {
    throw new Error('Account number not found in text');
  }
  return accountNumber.replaceAll(' ', '');
}

// parse the transaction date - may be null, or 2 formats
function getTransactionDate(dateStr, refDate) {
  if (!dateStr || dateStr.trim().length === 0) {
    if (!refDate) {
      throw new Error('No transaction date or previous date found');
    }
    return refDate;
  }
  const longDate = parse(dateStr.trim(), 'dd MMM yyyy', null); // must include the year
  if (isValid(longDate)) {
    return longDate;
  }
  const shortDate = parse(dateStr.trim(), 'dd MMM', refDate); // no year
  if (isValid(shortDate)) {
    return shortDate;
  }

  throw new Error(`Error parsing date: '${dateStr}'`);
}
