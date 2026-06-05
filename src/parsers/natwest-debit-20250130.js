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

export default async function parseStatement(pdfText, pdfFilename) {

  logger.debug('parseTransactions() called');

  const accountNumber = getAccountNumber(pdfText)[1].replaceAll(' ', '');
  const account = await getAccountByNumber(accountNumber);

  let sourceRow = 0;
  let previousDate;
  let previousBalance;

  // initialize transactions - adding extra transaction for starting balance
  const transactions = [];
  let match;
  // format: '26 OCT 28 OCT 00498929 FASTER PAYMENT RECEIVED - THANK YOU 1,481.41 -' 
  const transactionRegex = /^(\d{2} [A-Z]{3}(?: \d{4})?)?(.*?)(\d{1,3}(?:,\d{3})*\.\d{2} )?(\d{1,3}(?:,\d{3})*\.\d{2})$/gms;

  while ((match = transactionRegex.exec(getTransactionText(pdfText))) !== null) {

    //logger.debug(JSON.stringify(match, null, 2));

    let transDate = getTransactionDate(match[1], previousDate);
    if (!previousDate && !transDate) {
      throw new Error('No transaction date or previous date found');
    }
    if (!transDate) {
      transDate = previousDate;
    } else {
      previousDate = transDate;
    }

    const statement_balance = getAmountFromString(match[4]);

    let statement_amount;
    if (match[3]) {
      statement_amount = getAmountFromString(match[3]);
      // need to check if this is paid in or withdrawn
      if (!previousBalance) {
        // first transaction is b/f balance - acn ignore this
      } else if (previousBalance > statement_balance) {
        statement_amount = statement_amount * -1;
      }
    } else {
      statement_amount = 0;
    }

    previousBalance = statement_balance;

    const net_amount = statement_amount;

    let description = match[2];
    if (description) {
      description = description.replace('\n', ' ').replace(/\s\s+/g, ' ').trim();
    }

    transactions.push({
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
      trans_date: transDate,
      type: null,
      account: account.uuid,
      category: null,
      net_amount
    });
  }

  // sort on transaction date and source row (mastercard payment is not shown in order on statement)
  transactions.sort((a, b) => a.trans_date - b.trans_date || a.sourceRow - b.sourceRow);

  logger.debug('parseTransactions() completed successfully');

  return transactions;
}

function getAmountFromString(amountStr, signStr = '') {
  const sign = (signStr.trim() === '-' ? '-' : '+');
  return parseFloat(sign + amountStr.trim().replaceAll(',', ''));
}

// get account number from statement
// format: '87275643 60-01-04'
function getAccountNumber(text) {
  const regex = /(\d{8})\s(\d{2}-\d{2}-\d{2})/g;
  const match = regex.exec(text);
  if (!match || match.length !== 3) {
    throw new Error('Account number not found in text');
  }
  return match;
}

// remove text that sits between statement pages, and
// get the statement text from the start of the transactions
// to remove summary amounts and text
function getTransactionText(text) {
  // remove text that sits between statement pages
  const editedText = text.replace(/RETSTMT .*?Balance\(\£\)/gs, "");

  //logger.debug(editedText);

  // match text from the first 'Balance(£)' heder
  const regex = /Balance\(£\)\n?(.*)/gms;
  const match = regex.exec(editedText);
  if (!match || match.length !== 2) {
    throw new Error('Transaction text not found');
  }
  return match[1];
}

// parse the transaction date - may be null, or 2 formats
function getTransactionDate(dateStr, refDate) {
  if (!dateStr || dateStr.trim().length === 0) {
    return null;
  }
  const longDate = parse(dateStr.trim(), 'dd MMM yyyy', null); // must include the year
  if (isValid(longDate)) {
    return longDate;
  }
  const shortDate = parse(dateStr.trim(), 'dd MMM', refDate); // no year
  if (isValid(shortDate)) {
    return shortDate;
  }

  return null;
}
