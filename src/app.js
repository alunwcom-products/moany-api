import express from 'express';
import bodyParser from 'body-parser';
import winston from 'winston';
import { connection } from './lib/db.js';
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

app.post('/user', (req, res) => {
    logger.info(`POST user details: ${req.body.user}`);
    res.send(`User: ${req.body.user}`);
    connection.query('select * from users', [], (err, result) => {
        if (err) {
            logger.error('Error inserting transactions:', err);
            return;
        }
        logger.info(`Result set: ${JSON.stringify(result, null, 2)}`);
    });
});

// Start the server
app.listen(process.env.EXPRESS_PORT, () => {
    logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
