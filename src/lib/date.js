//
// date utility functions
//
import { parse, isValid, isBefore, format, isAfter, isEqual } from 'date-fns';
import logger from './logger.js';

const parseDate = (dateStr, format = 'yyyy-MM-dd') => {
  try {
    const date = parse(dateStr, format, null);
    return date;
  } catch (error) {
    logger.error(`Caught error in parseDate(${dateStr}, ${format})`);
    throw error;    
  }
};

const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  try {
    const dateStr = format(date, formatStr);
    return dateStr;
  } catch (error) {
    logger.error(`Caught error in formatDate(${date}, ${format})`);
    throw error;    
  }
}

// generate full date from a date string in the format 'dd MMM'
// throws error if date is not found
function getDateInRange(partialDateStr, startDate, endDate) {
  let date;
  try {
    // parse 2 possible full dates based on full start and end dates
    const earlierDate = parse(partialDateStr, 'dd MMM', startDate);
    const laterDate = parse(partialDateStr, 'dd MMM', endDate);
    // if both the same then no further checks needed
    if (isEqual(earlierDate, laterDate)) {
      return earlierDate;
    }
    // check if either date is within the date range
    if (!isBefore(earlierDate, startDate) && !isAfter(earlierDate, endDate)) {
      date = earlierDate;
    }
    if (!isBefore(laterDate, startDate) && !isAfter(laterDate, endDate)) {
      date = laterDate;
    }
    if (!date) {
      throw new Error('Supplied date is not within the date range');
    }
    return date;

  } catch (error) {
    logger.error('Caught error getting full date!');
    throw error;
  }
}

const MAX_DATE = new Date(9999, 11, 31); // 9999-12-31 NOTE: keep dates within mysql capacity (4-digit years)
const MIN_DATE = new Date(0, 0, 1); // 1900-01-01

export {
  formatDate,
  getDateInRange,
  MAX_DATE,
  MIN_DATE,
  parseDate
}