const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Get client IP address
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip ||
         '0.0.0.0';
};

/**
 * Generate OTP
 */
const generateOTP = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  getClientIP,
  generateOTP
};
