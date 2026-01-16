import express from 'express';
import bodyParser from 'body-parser';
import logger from './lib/logger.js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authenticate, getAccountSummary, getSystemInfo, setAccount } from './lib/db.js';
import { authenticateToken } from './lib/jwt.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

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
    console.warn(`Rate limit hit! ${req.ip} [${remote}]`);
    res.status(options.statusCode).send(options.message)
  },
});

app.use(limiter);
app.set('trust proxy', 1);

// var corsOptions = {
//     origin: 'http://example.com',
//     optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
//   }

app.use(cors());

// Routes

// GET account summary
app.get('/accountSummary', authenticateToken, async (req, res) => {
  const accounts = await getAccountSummary(logger);
  res.json({ results: accounts });
});

// PUT account
app.put('/account/', authenticateToken, async (req, res) => {
  //const uuid = req.params.uuid;
  //console.debug(req.body);
  const result = await setAccount(req.body);
  res.send({
    success: true
  })
})

// login/authenticate user
app.post('/user', async (req, res) => {
  logger.info(`POST user details: ${req.body.user}`);
  const token = await authenticate(req.body.user, req.body.password, logger);

  if (token) {
    res.header("X-New-Token", token);
    res.send({
      success: true,
      token: token
    });
    return;
  }

  res.sendStatus(401);
});

// GET healthcheck
app.get('/healthcheck', async (req, res) => {
  // check database connectivity
  const resultSet = await getSystemInfo(logger);
  // log db_version
  const db_version = resultSet.filter((row) => row.name === 'db_version');
  console.debug(`Healthcheck called. [db_version = ${db_version[0].value}]`);
  // success response
  res.json({
    timestamp: new Date().toISOString(),
    status: 'OK'
  });
});


// Start the server
app.listen(process.env.EXPRESS_PORT, () => {
  logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
