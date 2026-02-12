//
// PDF utilities, inc. file access
//

import fs from 'fs';
import pdfParse from 'pdf-parse-new';
import logger from './logger.js';

async function extractPdfText(pdfPathOrBuffer) {
    const dataBuffer = typeof pdfPathOrBuffer === 'string' ? fs.readFileSync(pdfPathOrBuffer) : pdfPathOrBuffer;
    try {
        const data = await pdfParse(dataBuffer, { verbosityLevel: 0 }); // output errors only
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
