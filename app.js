const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
const PORT = 3000;

// Dummy user for authentication (in a real app, this should be from a database)
const USER = {
    id: 1,
    username: 'user',
    password: 'password', // Note: In a real app, passwords should be hashed!
};

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
passport.use(new LocalStrategy((username, password, done) => {
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
    res.send('<h1>Protected Page</h1><p>Welcome to the protected page!</p><a href="/logout">Logout</a>');
});

app.get('/login', (req, res) => {
    const errorMessage = req.session.errorMessage;
    req.session.errorMessage = null; // Clear the message after displaying
    res.send(`
        <h1>Login</h1>
        <form method="POST" action="/login">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        ${errorMessage ? `<p style="color:red;">${errorMessage}</p>` : ''}
    `);
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
            // Handle any error that occurred during logout
            console.error('Logout error:', err);
            return res.redirect('/'); // Redirect to home or an error page
        }
        // Optionally, you can add any custom logic here
        console.log('User logged out successfully');

        // Redirect to login page after successful logout
        res.redirect('/login');
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
