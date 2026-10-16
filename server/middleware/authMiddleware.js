const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Authentication Middleware:
 * Checks for a valid JWT stored inside an HttpOnly cookie.
 * Attaches the verified user to `req.user`.
 */
const requireAuth = async (req, res, next) => {
  try {
    // 1. Read token from HttpOnly cookie or Authorization Bearer header
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
    const token = req.cookies?.token || bearerToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please sign in first.',
      });
    }

    // 2. Verify token with our secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Database connection check
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is temporarily unavailable. Please try again shortly.',
      });
    }

    // 4. Find user in the database (excluding password & OTP fields)
    const user = await User.findById(decoded.userId).select('-password -otpHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists. Please register again.',
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your email address is not verified yet.',
      });
    }

    // 4. Attach verified user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please sign in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token. Please sign in again.',
    });
  }
};

module.exports = {
  requireAuth,
};
