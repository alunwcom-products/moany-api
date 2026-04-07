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
import { getDateInRange } from '../lib/date.js';
import logger from "../lib/logger.js";
import { getAccountByNumber } from "../lib/db.js";

export default async function parseStatement(pdfText, pdfFilename) {

  logger.debug('parseTransactions() called');

  // logger.debug(`parseStatement [${pdfFilename}]:\n${pdfText}`);

  const accountNumber = getMastercardAccountNumber(pdfText)[1];
  const account = await getAccountByNumber(accountNumber.replaceAll(' ', ''));

  const startDateStr = getMastercardDateRange(pdfText)[1];
  const endDateStr = getMastercardDateRange(pdfText)[2];

  const startBalance = getBoughtForwardBalance(pdfText);
  // const endBalance = getCarryForwardBalance(pdfText);
  let accountBalance = startBalance;

  const endDate = parse(endDateStr, 'dd MMMM yyyy', null); // must include the year
  let startDate = parse(startDateStr, 'dd MMMM', endDate); // may not include the year - if same as end date year
  if (!isValid(startDate)) {
    startDate = parse(startDateStr, 'dd MMMM yyyy', null); // may include year - esp. if range across end of year
  }

  if (!isValid(startDate) || !isValid(endDate)) {
    throw new Error('Either start date or end date is invalid');
  }

  let sourceRow = 0;

  // initialize transactions - adding extra transaction for starting balance
  const transactions = [{
    uuid: getKey(),
    statement_amount: 0,
    description: 'BALANCE FROM PREVIOUS STATEMENT',
    comment: null,
    entry_date: new Date(),
    source_name: pdfFilename,
    source_row: ++sourceRow,
    source_type: 'STATEMENT',
    statement_balance: startBalance,
    account_balance: null,
    trans_date: startDate,
    type: null,
    account: account.uuid,
    category: null,
    net_amount: 0
  }];
  let match;
  // format: '26 OCT 28 OCT 00498929 FASTER PAYMENT RECEIVED - THANK YOU 1,481.41 -' 
  const transactionRegex = /(\d{2} [A-Za-z]{3})\s(\d{2} [A-Za-z]{3})\s(\d{8})?\s?(.*)\s(\d{1,3}(?:,\d{3})*\.\d{2})\s?([-+])?\n/g;

  while ((match = transactionRegex.exec(pdfText)) !== null) {

    // const transactionDate = getDateInRange(match[1], startDate, endDate);
    const postingDate = getDateInRange(match[2], startDate, endDate); // use posting date rather than transaction date

    const statement_amount = getAmountFromString(match[5], match[6]);
    const multiplier = -1;
    const net_amount = statement_amount * multiplier;

    transactions.push({
      uuid: getKey(),
      statement_amount,
      description: `${match[3]} ${match[4]}`,
      comment: null,
      entry_date: new Date(),
      source_name: pdfFilename,
      source_row: ++sourceRow,
      source_type: 'STATEMENT',
      statement_balance: null,
      account_balance: null,
      trans_date: postingDate,
      type: null,
      account: account.uuid,
      category: null,
      net_amount
    });
  }

  // sort on transacyion date and source row (mastercard payment is not shown in order on statement)
  transactions.sort((a, b) => a.trans_date - b.trans_date || a.sourceRow - b.sourceRow);

  logger.debug('parseTransactions() completed successfully');

  return transactions;
}

function getAmountFromString(amountStr, signStr) {
  const sign = (signStr === '-' ? '-' : '+');
  return parseFloat(sign + amountStr.replaceAll(',', '')).toFixed(2);
}

// get account number from mastercard statement
// format: 'MasterCard Number 5522 1396 0145 1168'
function getMastercardAccountNumber(text) {
  const regex = /(\d{4} \d{4} \d{4} \d{4})/g;
  const match = regex.exec(text);
  if (!match || match.length !== 2) {
    throw new Error('Account number not found in text');
  }
  return match;
}

// get date range from mastercard statement
// format: '12 January - 11 February 2025'
function getMastercardDateRange(text) {
  const regex = /(\d* [A-Za-z]*(?: \d{4})?) - (\d* [A-Za-z]* \d{4})/g;
  const match = regex.exec(text);
  if (!match || match.length !== 3) {
    throw new Error('Date range not found in text');
  }
  return match;
}

// get date range from mastercard statement
// format: '12 January - 11 February 2025'
function getBoughtForwardBalance(text) {
  const regex = /BALANCE.*FROM\s*PREVIOUS STATEMENT\s*£(\d{1,3}(?:,\d{3})*\.\d{2})\s?([-+])?/gi;
  const match = regex.exec(text);
  if (!match || match.length !== 3) {
    throw new Error('B/F balance not found in text');
  }
  return getAmountFromString(match[1], match[2]);
}
