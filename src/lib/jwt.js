import jwt from 'jsonwebtoken';

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

const authenticateToken = (req, res, next) => {
  // get token from request
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // if no token return 401
  if (token == null) return res.sendStatus(401);
  // verify token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    // if invalid token return 401
    if (err) return res.sendStatus(401);
    // otherwise, if valid generate new token and set response header
    const newToken = generateToken(decoded.userid, decoded.username);
    res.header("X-New-Token", newToken);
    // pass decoded user data from token in request
    req.user = decoded;
    next();
  });
};

export {
  authenticateToken,
  generateToken
};
