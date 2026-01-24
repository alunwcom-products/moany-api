import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import 'dotenv/config';

const logLevel = process.env.LOG_LEVEL || 'info'; // Default log level

const textFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Define the rotation transport
const fileRotateTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,      // Compresses old files to save space
  maxSize: '20m',           // Rotates when the file reaches 20MB
  maxFiles: '14d',          // Keeps only the last 14 days of logs
  level: logLevel,
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
    fileRotateTransport
  ]
});

export default logger;