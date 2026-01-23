import winston from 'winston';
import 'dotenv/config';

const logLevel = process.env.LOG_LEVEL || 'info'; // Default log level

const textFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Log stack traces for errors
    winston.format.splat(), // Allows for string formatting with %s, %d, etc.
    textFormat
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'error.log', level: 'error' }), // Log errors to error.log
    new winston.transports.File({ filename: 'app.log' }) // Log all levels to app.log
  ]
});

export default logger;
