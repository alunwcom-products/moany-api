import express from 'express';
import bodyParser from 'body-parser';
import logger from './lib/logger.js';
import cors from 'cors';
import { authenticate, getAccounts, getAccountSummary } from './lib/db.js';
import { authenticateToken, generateToken } from './lib/jwt.js';
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

// app.get('/users/:id', (req, res) => {
//     const userId = req.params.id;
//     logger.info(`GET user details: ${userId}`);
//     res.send(`Details of user ${userId}`);
// });

app.get('/accounts', authenticateToken, async (req, res) => {
    const accounts = await getAccounts(logger);
    res.json({ results: accounts });
});

app.get('/accountSummary', authenticateToken, async (req, res) => {
    const accounts = await getAccountSummary(logger);
    res.json({ results: accounts });
});

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

    res.status(403).json({
        success: false
    })
});

// Protected Route Example
// app.get('/protected', authenticateToken, (req, res) => {
//     res.json({
//         message: 'This is a protected route',
//         user: req.user
//     });
// });

// Start the server
app.listen(process.env.EXPRESS_PORT, () => {
    logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
