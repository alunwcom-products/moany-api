import express from 'express';
import bodyParser from 'body-parser';
import winston from 'winston';
import { authenticate } from './lib/db.js';
import { authenticateToken } from './lib/jwt.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json())

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

// Routes
app.get('/users/:id', (req, res) => {
    const userId = req.params.id;
    logger.info(`GET user details: ${userId}`);
    res.send(`Details of user ${userId}`);
});

app.post('/user', async (req, res) => {
    logger.info(`POST user details: ${req.body.user}`);
    res.send(await authenticate(req.body.user, req.body.password, logger)); 
});

// Protected Route Example
app.get('/protected', authenticateToken, (req, res) => {
    res.json({
        message: 'This is a protected route',
        user: req.user
    });
});

// Start the server
app.listen(process.env.EXPRESS_PORT, () => {
    logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
