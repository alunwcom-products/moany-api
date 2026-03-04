import { isValid, parse } from "date-fns";
import { v4 as uuidv4 } from 'uuid';
import logger from "../lib/logger.js";
import { getAccountByNumber } from "../lib/db.js";

export default async function parseTransactions(pdfText, pdfFilename) {

  logger.debug('parseTransactions() called');

  const accountNumberStr = getChaseAccountNumber(pdfText);
  // logger.debug(accountNumberStr);
  const account = await getAccountByNumber(accountNumberStr);
  // logger.debug(account);

  let sourceRow = 0;

  const transactions = [];
  const transactionRegex = /(?<=(\d{2} [A-Za-z]{3} \d{4}) (.*?) ([-+]?£\d{1,3}(?:,\d{3})*\.\d{2}) ([-+]?£\d{1,3}(?:,\d{3})*\.\d{2})) /g;
  const cleanedText = pdfText.replace(/\n/g, ' ');

  let match;

  while ((match = transactionRegex.exec(cleanedText)) !== null) {
    // logger.debug('Match found: [\'%s\',\'%s\',\'%s\',\'%s\']', match[1], match[2], match[3], match[4]);

    if (match[4]) { // this regex group is 'undefined' for opening and closing balances
      let description = match[2].trim();
      description = description.replace(/\s+(Purchase|Interest)$/, '');

      const trans_date = parse(match[1], 'dd MMM yyyy', null);
      const statement_amount = match[3].replace('£', '').replace(',', '');
      const statement_balance = match[4].replace('£', '').replace(',', '');

      transactions.push({
        uuid: uuidv4(),
        statement_amount,
        description: description,
        comment: null,
        entry_date: new Date(),
        source_name: pdfFilename,
        source_row: ++sourceRow,
        source_type: 'STATEMENT',
        statement_balance,
        account_balance: null,
        trans_date,
        type: null,
        account: account.uuid,
        category: null,
        net_amount: null
      });
    }
  }

  logger.debug('parseTransactions() completed successfully');

  return transactions;
}

// get account number from statement
// format: 'Account number: 18720627'
function getChaseAccountNumber(text) {
  const regex = /Account number:\s*(\d{8})/g;
  const match = regex.exec(text);
  if (!match || match.length !== 2) {
    throw new Error('Account number not found in text');
  }
  return match[1];
}
