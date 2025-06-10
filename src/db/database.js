import mysql from 'mysql2/promise';
import logger from './logger.js'; // Import the logger

// Database Configuration (from .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    waitForConnections: true,
    connectionLimit: 10, // Using a pool is crucial for production
    queueLimit: 0
};

let pool; // Declare a variable for the connection pool

// --- Initialize Database Pool ---
export const initializeDatabase = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        logger.info('Database connection pool created successfully.');
        logger.info(`Attempting to connect to database at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

        // Test connection
        await pool.getConnection();
        logger.info('Successfully connected to the database.');

    } catch (error) {
        logger.error('Failed to connect to the database:', error.message);
        process.exit(1); // Exit the application if DB connection fails
    }
};

// --- Database Query Functions ---

export const findUserByUsername = async (username) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT id, password, username, enabled FROM users WHERE username = ? LIMIT 1',
            [username]
        );
        return rows[0]; // Returns the user object or undefined
    } catch (error) {
        logger.error('Error finding user by username:', error.message);
        throw new Error('Database error during user lookup.'); // Re-throw a generic error to avoid exposing DB specifics
    } finally {
        if (connection) connection.release(); // Release the connection back to the pool
    }
};

// You can add other database interaction functions here as needed
