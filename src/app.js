import express from 'express';
import bodyParser from 'body-parser';
import logger from './lib/logger.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { 
  authenticate, 
  calculateAccountBalances, 
  getAccountByUuid, 
  getAccountSummary, 
  getCategories, 
  getMonthlyTotals, 
  getSystemInfo, 
  getTransactions, 
  setAccount, 
  setCategory, 
  setTransaction, 
  storeTransactions
} from './lib/db.js';
import parseChaseStatement from './parsers/chase-20230831.js';
import parseMCardStatement from './parsers/mastercard-20250111.js';
import parseNatwestDebit from './parsers/natwest-debit-20250130.js';
import { authenticateToken, clearCookie, generateToken, setCookie } from './lib/jwt.js';
import { extractPdfText } from './lib/pdf.js';
import { MAX_DATE, MIN_DATE, parseDate } from './lib/date.js';

import 'dotenv/config';

const RATE_LIMIT_WINDOW_MINUTES = process.env.RATE_LIMIT_WINDOW_MINUTES || 3;
const RATE_LIMIT_REQUESTS = process.env.RATE_LIMIT_REQUESTS || 150;

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MINUTES * 60 * 1000, // 15 minutes
  limit: RATE_LIMIT_REQUESTS, // limit to each IP per `windowMs`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
  handler: (req, res, next, options) => {
    const remote = req.headers['x-forwarded-for'];
    logger.warn(`Rate limit hit! ${req.ip} [${remote}]`);
    res.status(options.statusCode).send(options.message)
  },
});

var corsOptions = {
  //exposedHeaders: ['X-New-Token'],
  //origin: 'http://localhost:5173',
  origin: process.env.FRONT_END_HOSTNAME || 'http://localhost:5173',
  credentials: true,
  //optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

logger.info(`Preparing server... [EXPRESS_PORT=${process.env.EXPRESS_PORT}, NODE_ENV=${process.env.NODE_ENV}, FRONT_END_HOSTNAME=${process.env.FRONT_END_HOSTNAME}]`);

// Instantiate express with middleware
const app = express();
app.use(cookieParser());
// Increase body size limits to allow larger uploads and large JSON bodies
app.use(bodyParser.json({ limit: '20mb' })); // TODO make configurable
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true })); // TODO make configurable
app.use(cors(corsOptions));
app.use(limiter);
app.set('trust proxy', 1);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 2 * 1024 * 1024 } // 10MB file, 2MB fields // TODO make configurable
});

// statement parsers (TODO factor out)
const parsers = {
  chase: parseChaseStatement,
  mcard: parseMCardStatement,
  nwdeb: parseNatwestDebit

}

// PUBLIC ROUTES

// GET healthcheck
app.get('/healthcheck', async (req, res) => {
  // check database connectivity
  const resultSet = await getSystemInfo();
  // log db_version
  const db_version = resultSet.filter((row) => row.name === 'db_version');
  logger.info(`Healthcheck called [db_version = ${db_version[0].value}]`);
  // success response
  res.json({
    timestamp: new Date().toISOString(),
    status: 'OK',
    version: process.env.APP_VERSION || 'development',
  });
});

// POST user session (authenticate)
app.post('/session', async (req, res) => {
  const result = await authenticate(req.body.user, req.body.password);

  if (result) {
    const token = generateToken(req, result.id, result.username);
    logger.info(`Successful authentication for user '${result.username}'`);
    setCookie(res, token);
    res.send({
      id: req.user.userid,
      user: req.user.username,
      exp: req.user.exp,
    });
    return;
  }

  // failed authentication
  logger.warn(`Invalid authentication attempt for user '${req.body.user}'`);
  // clearCookie(res);
  res.sendStatus(401);
});

// PRIVATE ROUTES

// GET account summary
app.get('/accountSummary', authenticateToken, async (req, res) => {
  const accounts = await getAccountSummary();
  logger.info(`Got account summary [user = '${req.user.username}']`);
  res.json({ results: accounts });
});

// PUT account
app.put('/account/', authenticateToken, async (req, res) => {
  const result = await setAccount(req.body);
  logger.info(`Set account [user = '${req.user.username}']`);
  res.send({
    success: true
  })
});

// GET categories
app.get('/categories', authenticateToken, async (req, res) => {
  const categories = await getCategories();
  logger.info(`Got categories [user = '${req.user.username}']`);
  res.json({ results: categories });
});

// PUT categories
app.put('/categories/', authenticateToken, async (req, res) => {
  const category = await setCategory(req.body);
  logger.info(`Set category [user = '${req.user.username}']`);
  res.json(category);
});

// GET transactions
app.get('/transactions', authenticateToken, async (req, res) => {

  const limit = Number(req.query.limit) || 100; // TODO configurable default?
  const offset = Number(req.query.offset) || 0;

  // If single account (a string) wrap as array
  // filter(Boolean) handles undefined account parameter
  const accounts = Array.isArray(req.query.account) 
    ? req.query.account 
    : [req.query.account].filter(Boolean);

  // Get start and end dates, if no date use 'min' or 'max' date
  const startDate = req.query.startDate ? parseDate(req.query.startDate) : MIN_DATE;
  const endDate = req.query.endDate ? parseDate(req.query.endDate) : MAX_DATE;

  const response = await getTransactions(limit, offset, accounts, startDate, endDate);
  logger.info(`Got transactions [user = '${req.user.username}', count = ${response.results.length} offset/limit = ${offset}/${limit}]`);
  res.json(response);
});

// PUT transaction
app.put('/transaction/', authenticateToken, async (req, res) => {
  const transaction = await setTransaction(req.body);
  logger.info(`Set transaction [user = '${req.user.username}']`);
  res.json(transaction);
})

// POST statement (file upload)
app.post('/statement', authenticateToken, upload.single('file'), async (req, res) => {
  logger.debug('POST /statement called');
  try {
    const { statementType } = req.body;
    const user = req.user?.username;
    const file = req.file;

    if (!file) {
      logger.warn(`Statement upload failed - no file provided [user = '${user}']`);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!statementType || statementType.length === 0) {
      logger.warn(`Statement upload failed - no statement type provided [user = '${user}']`);
      return res.status(400).json({ error: 'No statement type provided' });
    }

    const parser = parsers[statementType];
    if (!parser) {
      logger.warn(`Statement upload failed - no parser found to match statement type '${statementType}' [user = '${user}']`);
      return res.status(400).json({ error: 'Invalid statement type provided' });
    }

    logger.info(`Statement file uploaded [user = '${user}', filename = '${file.originalname}', mimetype = ${file.mimetype}, size = ${file.size} bytes, type = '${statementType}']`);

    // parse uploaded file 

    let transactions; // parsed transactions

    if (file.mimetype === 'application/pdf') {
      const pdfText = await extractPdfText(file.buffer);
      transactions = await parser(pdfText, file.originalname);

      // TODO only handling PDFs currently
      // } else if (file.mimetype === 'text/csv') {
      //     logger.info('Handling CSV file');
      //     await new Promise((resolve, reject) => {
      //         fs.createReadStream(filePath)
      //             .pipe(csv())
      //             .on('data', (row) => {
      //                 transactions.push(row);
      //             })
      //             .on('end', resolve)
      //             .on('error', reject);
      //     });

    } else {
      logger.warn(`Statement upload failed - unsupported file type [user = '${user}']`);
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    if (transactions.length > 0) {
      logger.info(`${transactions.length} transactions received from statement`);
      // persist transactions
      await storeTransactions(transactions);
      // update net amounts and account balance
      const account = await getAccountByUuid(transactions[0].account);
      await calculateAccountBalances(account);

    } else {
      logger.warn(`Statement upload failed - no transactions found in file [user = '${user}']`);
      return res.status(400).json({ error: 'No transactions found in the file' });
    }

  } catch (error) {
    logger.error(`Statement upload error [user = '${req.user.username}', error = '${error.message}']`);
    return res.status(500).json({ error: 'Internal server error' });
  }

  logger.debug('POST /statement completed successfully');

  res.json({
    success: true,
    message: 'File uploaded successfully.'
  });
});

// GET user session
app.get('/session', authenticateToken, async (req, res) => {
  const { userid, username } = req.user;
  logger.info(`Got session (refresh) [user = '${req.user.username}']`);
  res.send({
    id: req.user.userid,
    user: req.user.username,
    exp: req.user.exp,
  });
});

// DELETE user session
app.delete('/session', authenticateToken, async (req, res) => {
  const user = req.user?.username;
  logger.info(`Delete session [user = '${user}']`);
  clearCookie(res);
  res.sendStatus(204);
});

// GET monthly totals
app.get('/monthly-totals', authenticateToken, async (req, res) => {
  const totals = await getMonthlyTotals();
  logger.info(`Got monthly totals [user = '${req.user.username}']`);
  res.json({ results: totals });
});

// START THE SERVER

app.listen(process.env.EXPRESS_PORT, () => {
  logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
