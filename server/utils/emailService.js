const crypto = require('crypto');

/**
 * Brevo Transactional Email Endpoint
 */
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds timeout

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 * crypto.randomInt is cryptographically stronger than Math.random().
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Construct safe, clean HTML for verification email.
 */
const buildOtpHtml = (otp) => {
  return `
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
  `;
};

/**
 * Sends a 6-digit OTP to the recipient's email using Brevo HTTP API.
 * Never logs credentials, secrets, or OTP values.
 *
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{ success: boolean, messageId: string }>}
 */
const sendOtpEmail = async (email, otp) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Recipient email is required.');
  }

  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP is required.');
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Auth-Jarvis';

  if (!apiKey || !apiKey.trim() || !senderEmail || !senderEmail.trim()) {
    const errorMsg =
      'Email service not configured. Please set BREVO_API_KEY and BREVO_SENDER_EMAIL in environment variables.';
    console.error('[Email Service] Configuration missing: BREVO_API_KEY or BREVO_SENDER_EMAIL not set.');
    throw new Error(errorMsg);
  }

  const payload = {
    sender: {
      name: senderName.trim(),
      email: senderEmail.trim(),
    },
    to: [
      {
        email: email.trim(),
      },
    ],
    subject: 'Your email verification OTP',
    htmlContent: buildOtpHtml(otp),
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[Email Service] Brevo API request failed with HTTP status: ${response.status}`
      );
      throw new Error(`Failed to send verification email. Provider status: ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));

    console.log('[Email Service] Verification OTP email dispatched successfully.');
    return {
      success: true,
      messageId: data?.messageId || 'sent',
    };
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error('[Email Service] Request timed out while connecting to Brevo API.');
      throw new Error('Failed to send verification email due to a connection timeout.');
    }

    // Never log the sensitive payload or credentials
    console.error('[Email Service] Error communicating with Brevo API:', error.message);
    throw error;
  }
};

module.exports = {
  generateOTP,
  sendOtpEmail,
  sendOTPEmail: sendOtpEmail, // Backward compatibility alias
};
