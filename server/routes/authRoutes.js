const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  signup,
  verifyOTP,
  resendOTP,
  login,
  getMe,
  logout,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Rate Limiter for general authentication endpoints (signup, login)
 * 20 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict Rate Limiter for OTP operations (resend, verify)
 * 10 requests per 15 minutes per IP to prevent brute-force attacks
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 15 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication routes
router.post('/signup', authLimiter, signup);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/resend-otp', otpLimiter, resendOTP);
router.post('/login', authLimiter, login);

// Protected routes
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

module.exports = router;
