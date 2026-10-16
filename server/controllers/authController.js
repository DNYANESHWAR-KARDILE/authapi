const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP, sendOTPEmail } = require('../utils/sendOTP');

/**
 * Checks if MongoDB is currently connected.
 * Returns an instant 503 response if disconnected instead of buffering and timing out.
 */
const isDatabaseConnected = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message:
        'Database connection is unavailable. Please check that MongoDB is running or set your MONGODB_URI (e.g. MongoDB Atlas) in server/.env.',
    });
    return false;
  }
  return true;
};

/**
 * Cookie options helper for consistent cookie configuration.
 * HttpOnly protects against XSS token theft.
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    secure: isProduction, // Only sent over HTTPS in production
    sameSite: isProduction ? 'none' : 'lax', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user, hash password, create & email OTP
 */
const signup = async (req, res) => {
  try {
    if (!isDatabaseConnected(res)) return;

    const { name, email, password, confirmPassword } = req.body;

    // 1. Validation: check required fields
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Name, Email, Password, Confirm Password) are required.',
      });
    }

    // 2. Validation: email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // 3. Validation: password match & minimum length
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 4. Check for existing user
    let existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Please sign in.',
      });
    }

    // 5. Generate secure 6-digit OTP and calculate expiry (5 minutes)
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 6. Hash password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 7. Attempt to send OTP email BEFORE finalizing user creation
    // If sending fails, we don't mislead the user
    try {
      await sendOTPEmail(normalizedEmail, otp);
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        message:
          emailError.message ||
          'Failed to send OTP verification email. Please verify email credentials in server/.env.',
      });
    }

    // 8. Save user to database
    if (existingUser) {
      // User exists but was not verified: update credentials and reset OTP
      existingUser.name = name.trim();
      existingUser.password = hashedPassword;
      existingUser.otpHash = otpHash;
      existingUser.otpExpiresAt = otpExpiresAt;
      existingUser.otpAttempts = 0;
      existingUser.otpLastSentAt = new Date();
      await existingUser.save();
    } else {
      // Create fresh unverified user
      await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isEmailVerified: false,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! A 6-digit OTP has been sent to your email.',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[Signup Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during signup. Please try again later.',
    });
  }
};

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify 6-digit email OTP and mark account as verified
 */
const verifyOTP = async (req, res) => {
  try {
    if (!isDatabaseConnected(res)) return;

    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP are required.',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be exactly 6 digits.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please register first.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Your email is already verified. Please sign in.',
      });
    }

    // Check if OTP was generated
    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP found. Please request a new OTP.',
      });
    }

    // Check expiration (5 minutes)
    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please click "Resend OTP" to get a fresh code.',
      });
    }

    // Check maximum failed attempts (limit: 5)
    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // Compare entered OTP with hashed OTP in MongoDB
    const isMatch = await bcrypt.compare(cleanOtp, user.otpHash);

    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();

      const remainingAttempts = Math.max(0, 5 - user.otpAttempts);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remainingAttempts} attempts remaining before reset.`,
      });
    }

    // Successful OTP match: mark verified and wipe OTP data
    user.isEmailVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.otpLastSentAt = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified! You can now sign in.',
    });
  } catch (error) {
    console.error('[Verify OTP Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during OTP verification. Please try again.',
    });
  }
};

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend a new 6-digit OTP with a 60-second cooldown
 */
const resendOTP = async (req, res) => {
  try {
    if (!isDatabaseConnected(res)) return;

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found with this email.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. Please sign in.',
      });
    }

    // 60-second cooldown enforcement
    const COOLDOWN_SECONDS = 60;
    if (user.otpLastSentAt) {
      const timeSinceLastSent = (Date.now() - user.otpLastSentAt.getTime()) / 1000;
      if (timeSinceLastSent < COOLDOWN_SECONDS) {
        const secondsLeft = Math.ceil(COOLDOWN_SECONDS - timeSinceLastSent);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secondsLeft} second(s) before requesting another OTP.`,
        });
      }
    }

    // Generate new OTP & calculate 5 min expiry
    const newOtp = generateOTP();
    const newOtpHash = await bcrypt.hash(newOtp, 10);
    const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Send email
    try {
      await sendOTPEmail(normalizedEmail, newOtp);
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        message: emailError.message || 'Failed to send OTP email.',
      });
    }

    // Update user record
    user.otpHash = newOtpHash;
    user.otpExpiresAt = newExpiresAt;
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit OTP has been sent to your email.',
    });
  } catch (error) {
    console.error('[Resend OTP Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while resending OTP. Please try again.',
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, reject unverified emails, set HttpOnly JWT cookie
 */
const login = async (req, res) => {
  try {
    if (!isDatabaseConnected(res)) return;

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Generic error message prevents username/email enumeration attacks
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if user has verified their email OTP
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your email has not been verified. Please verify your OTP to continue.',
        unverified: true,
        email: user.email,
      });
    }

    // Generate signed JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store JWT in an HttpOnly cookie
    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Welcome back! Signed in successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during sign in. Please try again.',
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info (Protected)
 */
const getMe = async (req, res) => {
  try {
    // req.user was attached by authMiddleware.requireAuth
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        isEmailVerified: req.user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error('[GetMe Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.',
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Clear the HttpOnly authentication cookie
 */
const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('[Logout Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout.',
    });
  }
};

module.exports = {
  signup,
  verifyOTP,
  resendOTP,
  login,
  getMe,
  logout,
};
