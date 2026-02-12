//
// date utility functions
//
import { parse, isValid, isBefore, format, isAfter, isEqual } from 'date-fns';

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

export {
  getDateInRange
}