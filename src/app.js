import express from 'express';
import bodyParser from 'body-parser';
import logger from './lib/logger.js';
import cors from 'cors';
import { authenticate, getAccountSummary, getSystemInfo } from './lib/db.js';
import { authenticateToken } from './lib/jwt.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

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
