const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 * crypto.randomInt is cryptographically stronger than Math.random().
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Creates a reusable Nodemailer transporter using credentials from .env.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Sends a 6-digit OTP to the recipient's email address.
 * Throws an error if sending fails so the controller can handle it safely.
 */
const sendOTPEmail = async (email, otp) => {
  // If email credentials are not configured or are placeholder values
  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS ||
    process.env.EMAIL_USER === 'your_email@gmail.com'
  ) {
    const errorMsg =
      'Email service not configured. Please set EMAIL_USER and EMAIL_PASS (Gmail App Password) in server/.env.';
    console.error(`[Email Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Auth Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code (OTP)',
    text: `Your verification code is: ${otp}. This code is valid for 5 minutes. Please do not share this code with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333333; text-align: center;">Verify Your Email</h2>
        <p style="color: #555555; font-size: 15px;">Hello,</p>
        <p style="color: #555555; font-size: 15px;">Thank you for registering. Use the 6-digit code below to verify your email address:</p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #eef2ff; padding: 12px 28px; border-radius: 8px; border: 1px dashed #6366f1;">
            ${otp}
          </span>
        </div>
        <p style="color: #666666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
        <p style="color: #999999; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
          If you did not request this email, please ignore it.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('[Email Service] Error sending email:', error.message);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
