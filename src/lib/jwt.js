import jwt from 'jsonwebtoken';

// Secret key for JWT (store this securely, preferably in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

const generateToken = (userid, username) => {
  return jwt.sign(
    { userid, username },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

export {
  authenticateToken,
  generateToken
};
