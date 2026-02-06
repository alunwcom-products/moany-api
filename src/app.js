import express from 'express';
import bodyParser from 'body-parser';
import logger from './lib/logger.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authenticate, getAccountSummary, getSystemInfo, setAccount } from './lib/db.js';
import { authenticateToken, clearCookie, setCookie } from './lib/jwt.js';

import 'dotenv/config';

const RATE_LIMIT_WINDOW_MINUTES = process.env.RATE_LIMIT_WINDOW_MINUTES || 15;
const RATE_LIMIT_REQUESTS = process.env.RATE_LIMIT_REQUESTS || 100;

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
  origin: 'http://localhost:5173',
  credentials: true,
  //optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Instantiate express with middleware
const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors(corsOptions));
app.use(limiter);
app.set('trust proxy', 1);

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
    status: 'OK'
  });
});

// POST user session (authenticate)
app.post('/session', async (req, res) => {
  const token = await authenticate(req.body.user, req.body.password);
  const user = req.body.user;
  if (token) {
    logger.info(`Successful authentication for user '${user}'`);
    setCookie(res, token);
    res.send({
      user,
    });
    return;
  }
  // failed authentication
  logger.warn(`Invalid authentication attempt for user '${user}'`);
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
})

// GET user session
app.get('/session', authenticateToken, async (req, res) => {
  const user = req.user?.username;
  logger.info(`Got session (refresh) [user = '${user}']`);
  res.json({ user });
});

// DELETE user session
app.delete('/session', authenticateToken, async (req, res) => {
  const user = req.user?.username;
  logger.info(`Delete session [user = '${user}']`);
  clearCookie(res);
  res.sendStatus(204);
});

// START THE SERVER

app.listen(process.env.EXPRESS_PORT, () => {
  logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
