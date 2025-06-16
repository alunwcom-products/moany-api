import express from 'express';
import bodyParser from 'body-parser';
import logger from './utilities/logger.js';
import cors from 'cors';

import { initializeDatabase } from './db/database.js';
import { generateJWT, verifyJWT, authenticate } from './utilities/auth.js';
import dotenv from 'dotenv';

dotenv.config();

await initializeDatabase();

const app = express();
app.use(bodyParser.json());

app.use(cors({ 
    origin: '*.alunw.com'
}));

// middleware
async function authenticateToken(req, res, next) {
   const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Authentication attempt without token.');
        return res.sendStatus(401); // No token, unauthorized
    }

    verifyJWT(token).then(payload => {
        generateJWT(payload.id, payload.username).then(newToken => {
            res.setHeader('X-New-Token', newToken); 
            next();
        }).catch(err => {
            return res.status(500).json({ message: '#1' });
        });
    }).catch(err => {
        return res.status(500).json({ message: '#2' });
    });
}

// Routes
app.get('/healthcheck', (req, res) => {
    logger.info('GET healthcheck');
    res.json({ status: 'ok' });
});

app.post('/login', async (req, res, next) => {
    logger.info('POST login attempt');
    const { username, password } = req.body;
    const result = await authenticate(username, password).catch(err => {
        return res.status(500).json({ message: 'Internal server error' });
    });
    if (result) {
        res.setHeader('X-New-Token', result);
        return res.json({ 
            message: 'success', 
            token: result,
            payload: await verifyJWT(result) });
    }
    return res.status(401).json({ message: 'Authentication error' });
});

// app.get('/users/:id', (req, res) => {
//     const userId = req.params.id;
//     logger.info(`GET user details: ${userId}`);
//     res.send(`Details of user ${userId}`);
// });

app.get('/accounts', authenticateToken, async (req, res) => {
    // const accounts = await getAccounts(logger);
    // const userId = req.params.id;
    // logger.info(`GET user details: ${userId}`);
    // res.send(`Details of user ${userId}`);
    return res.json({ results: 'not implemented' });
});

// app.post('/user', async (req, res) => {
//     logger.info(`POST user details: ${req.body.user}`);
//     res.send(await authenticate(req.body.user, req.body.password, logger)); 
// });

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
