import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import 'dotenv/config';

import logger from './logger.js';
import { initializeDatabase, findUserByUsername } from './lib/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION_TIME = process.env.JWT_EXPIRATION_TIME || '1h'; // For initial token and refreshed token

// --- Basic validation for critical environment variables ---
if (!JWT_SECRET) {
    logger.error('ERROR: JWT_SECRET is not set in environment variables or .env file!');
    process.exit(1);
}
// Database configuration validation is now handled within lib/database.js
// but we should ensure DB related env vars are present if database.js doesn't exit on their absence.
// For this example, we assume `initializeDatabase` handles it.

// --- Middleware for JWT Validation ---
// This middleware will also generate a new token if authentication is successful
async function authenticateToken(token) {
    // const authHeader = req.headers['authorization'];
    // const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Authentication attempt without token.');
        return res.sendStatus(401); // No token, unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.error('JWT Verification Error:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            return res.sendStatus(403); // Invalid token, forbidden
        }

        req.user = user; // Attach decoded user payload to request

        // Re-sign a new token to extend session or rotate tokens
        const newPayload = { userId: user.userId, username: user.username };
        jwt.sign(newPayload, JWT_SECRET, { expiresIn: JWT_EXPIRATION_TIME }, (signErr, newToken) => {
            if (signErr) {
                logger.error('Error generating new JWT for protected route:', signErr);
                return res.status(500).json({ message: 'Error generating new token.' });
            }
            res.setHeader('X-New-Token', newToken); // Send new token in a custom header
            // Or, you could include it in the response body if it's a JSON API and appropriate
            next(); // Proceed to the next middleware/route handler
        });
    });
}

// --- Routes ---

// 1. Login Route: Authenticates user and generates JWT
// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;

//     if (!username || !password) {
//         logger.warn('Login attempt with missing username or password.');
//         return res.status(400).json({ message: 'Username and password are required.' });
//     }

//     try {
//         const user = await findUserByUsername(username); // Use database module to find user

//         if (!user || !user.enabled) { // Check if user exists and is enabled
//             logger.info(`Login failed for username: ${username} - Invalid credentials or user disabled.`);
//             return res.status(401).json({ message: 'Invalid credentials or user disabled.' });
//         }

//         // Compare the provided password with the stored hashed password
//         const passwordMatch = await bcrypt.compare(password, user.password);

//         if (!passwordMatch) {
//             logger.info(`Login failed for username: ${username} - Incorrect password.`);
//             return res.status(401).json({ message: 'Invalid credentials.' });
//         }

//         // User authenticated, create JWT
//         const payload = { userId: user.id, username: user.username };

//         jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION_TIME }, (err, token) => {
//             if (err) {
//                 logger.error('Error generating JWT during login:', err);
//                 return res.status(500).json({ message: 'Error generating token.' });
//             }
//             logger.info(`User ${username} logged in successfully.`);
//             res.json({ message: 'Login successful', token: token });
//         });
//     } catch (error) {
//         logger.error('Error during login process:', error);
//         res.status(500).json({ message: 'Internal server error during login.' });
//     }
// });

// 2. Protected Route: Requires a valid JWT to access and returns a new token
// app.get('/protected', authenticateToken, (req, res) => {
//     // If we reach here, the token was valid, and a new token was set in the 'X-New-Token' header.
//     logger.info(`Access granted to protected route for user: ${req.user.username}`);
//     res.json({
//         message: 'Welcome to the protected route!',
//         user: req.user,
//         serverTime: new Date().toISOString(),
//         // Client should check the 'X-New-Token' header for the updated token
//     });
// });

// 3. Simple Public Route
// app.get('/', (req, res) => {
//     logger.info('Access to public root route.');
//     res.send('Welcome to the JWT Auth Example with MySQL, ESM, Dotenv, Logging, and Token Refresh!');
// });

// --- Start Server ---
// Initialize the database connection pool before starting the server
initializeDatabase().then(() => {
    // app.listen(port, () => {
    //     logger.info(`Server running at http://localhost:${port}`);
    //     logger.info(`Try POST to http://localhost:${port}/login with { "username": "<user>", "password": "<password>" }`);
    //     logger.info(`Then use the token in a GET request to http://localhost:${port}/protected with Authorization: Bearer <YOUR_TOKEN>`);
    //     logger.info(`The protected route will return a new token in the 'X-New-Token' header.`);
    // });
}).catch(err => {
    // This catch block handles errors from initializeDatabase if it doesn't exit process directly
    logger.error('Failed to start application due to database initialization error.', err);
    process.exit(1);
});
