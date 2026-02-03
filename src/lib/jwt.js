import jwt from 'jsonwebtoken';
import logger from './logger.js';

// Secret key for JWT (store this securely, preferably in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';

const generateToken = (userid, username) => {
  return jwt.sign(
    { userid, username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

const setCookie = (res, token) => {
  res.cookie('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    secure: process.env.NODE_ENV !== 'development',
  });
};

const authenticateToken = (req, res, next) => {
  // get token from request
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // if no token return 401
  if (token == null) {
    logger.debug('HTTP 401 - no token');
    setCookie(res, '');
    return res.sendStatus(401);
  }
  // verify token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    // if invalid token return 401
    if (err) {
      logger.debug('HTTP 401 - invalid token');
      setCookie(res, '');
      return res.sendStatus(401);
    }
    // otherwise, if valid generate new token and set response header
    const newToken = generateToken(decoded.userid, decoded.username);
    logger.debug('New token generated');
    res.header("X-New-Token", newToken);
    setCookie(res, newToken);
    // pass decoded user data from token in request
    req.user = decoded;
    next();
  });
};

export {
  authenticateToken,
  generateToken,
  setCookie,
};
