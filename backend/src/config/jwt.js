const crypto = require('crypto');

const generateJwtSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

module.exports = {
  secret: process.env.JWT_SECRET || generateJwtSecret(),
  expiresIn: '24h'
};