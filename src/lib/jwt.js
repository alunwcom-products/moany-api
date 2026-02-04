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
};

const setCookie = (res, token) => {
  res.cookie('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 15 * 60 * 1000, // TODO config
    secure: process.env.NODE_ENV !== 'development', // TODO config
  });
};

const clearCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development', // TODO config
    sameSite: 'Lax'
  });
};

const authenticateToken = (req, res, next) => {
  // get token from cookie
  const token = req.cookies.token;
  logger.debug(`Got cookie: ${token}`);
  // if no token return 401
  if (token == null) {
    logger.debug('HTTP 401 - no token');
    // setCookie(res, '');
    clearCookie(res);
    return res.sendStatus(401);
  }
  // verify token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    // if invalid token return 401
    if (err) {
      logger.debug('HTTP 401 - invalid token');
      // setCookie(res, '');
      clearCookie(res);
      return res.sendStatus(401);
    }
    // otherwise, if valid generate new token and set response header
    const newToken = generateToken(decoded.userid, decoded.username);
    logger.debug('New token generated');
    // res.header("X-New-Token", newToken);
    setCookie(res, newToken);
    // pass decoded user data from token in request
    req.user = decoded;
    next();
  });
};

export {
  authenticateToken,
  clearCookie,
  generateToken,
  setCookie,
};
