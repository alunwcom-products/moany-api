import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import passport from 'passport';
import { Strategy } from 'passport-local';
import winston from 'winston';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

const app = express();

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

// Dummy user for authentication (in a real app, this should be from a database)
const USER = {
    id: 1,
    username: 'user',
    password: 'password', // Note: In a real app, passwords should be hashed!
};

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(import.meta.dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key', // Change this to a secure key in production
    resave: false,
    saveUninitialized: false,
}));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Local Strategy
passport.use(new Strategy((username, password, done) => {
    if (username === USER.username && password === USER.password) {
        return done(null, USER);
    } else {
        return done(null, false, { message: 'Invalid username or password' });
    }
}));

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser((id, done) => {
    if (id === USER.id) {
        done(null, USER);
    } else {
        done(new Error('User not found'));
    }
});

// Function to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', isAuthenticated, (req, res) => {
    res.render('protected', { username: req.user.username });
});

app.get('/login', (req, res) => {
    const errorMessage = req.session.errorMessage;
    req.session.errorMessage = null; // Clear the message after displaying
    res.render('login', { errorMessage });
});

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
            req.session.errorMessage = info.message; // Set the error message in session
            return res.redirect('/login'); // Redirect back to the login page
        }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            return res.redirect('/'); // Successful login
        });
    })(req, res, next);
});

// Updated Logout with Callback
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/'); // Redirect to home or an error page
        }
        console.log('User logged out successfully');
        res.redirect('/login'); // Redirect to login page after successful logout
    });
});

// Start the server
app.listen(process.env.EXPRESS_PORT, () => {
    logger.info(`Server started on port ${process.env.EXPRESS_PORT}`);
});
