//
// PDF utilities, inc. file access
//

import pdfParse from 'pdf-parse-new';
import logger from './logger.js';

async function extractPdfText(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer, { verbosityLevel: 0 }); // output errors only
    // logger.debug('Extracted text from PDF: %s', data.text);
    return data.text;
  } catch (error) {
    logger.error('Error parsing PDF:', error);
    return null;
  }
}

export {
  extractPdfText
}
