/**
 * sendOTP.js
 *
 * Re-exports OTP generation and Brevo HTTP-based email sending logic
 * from emailService.js to maintain 100% backward compatibility across the project.
 */
const { generateOTP, sendOtpEmail } = require('./emailService');

module.exports = {
  generateOTP,
  sendOtpEmail,
  sendOTPEmail: sendOtpEmail,
};
