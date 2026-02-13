import jwt from 'jsonwebtoken';
import logger from './logger.js';

// Secret key for JWT (store this securely, preferably in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15'; // in minutes

const generateToken = (req, userid, username) => {
  // create expiry time manually to allow it to be returned in api response
  const now = Date.now();
  const exp = Math.floor(now / 1000) + (60 * JWT_EXPIRY);
  // store user token details in req object 
  req.user = {
    userid, username, exp
  };

  const token =  jwt.sign(
    req.user, JWT_SECRET
  );
  return token;
};

const setCookie = (res, token) => {
  res.cookie('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 15 * 60 * 1000, // TODO config
    secure: process.env.NODE_ENV !== 'development', // TODO config
  });
};

const clearCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development', // TODO config
    sameSite: 'Strict'
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
    const newToken = generateToken(req, decoded.userid, decoded.username);
    logger.debug('New token generated');
    setCookie(res, newToken);
    next();
  });
};

export {
  authenticateToken,
  clearCookie,
  generateToken,
  setCookie,
};
