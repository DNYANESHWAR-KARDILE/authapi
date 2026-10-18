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
 * Send email via Brevo REST API (HTTPS port 443 - works on Render Free Tier).
 * Free tier provides 300 emails/day to any recipient without domain verification.
 */
const sendViaBrevo = async (email, otp, htmlContent, textContent) => {
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    'no-reply@example.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Auth Support';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY.trim(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject: 'Your Verification Code (OTP)',
      htmlContent,
      textContent,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorDetail =
      data.message || `Brevo API HTTP ${response.status}: ${response.statusText}`;
    console.error('[Email Service - Brevo Error]', errorDetail);
    throw new Error(`Failed to send email via Brevo: ${errorDetail}`);
  }

  console.log('[Email Service] OTP successfully sent via Brevo API to', email);
  return { messageId: data.messageId };
};

/**
 * Send email via Resend REST API (HTTPS port 443 - works on Render Free Tier).
 */
const sendViaResend = async (email, otp, htmlContent, textContent) => {
  const fromAddress =
    process.env.RESEND_FROM || 'Auth Support <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [email],
      subject: 'Your Verification Code (OTP)',
      html: htmlContent,
      text: textContent,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorDetail =
      data.message || `Resend API HTTP ${response.status}: ${response.statusText}`;
    console.error('[Email Service - Resend Error]', errorDetail);
    throw new Error(`Failed to send email via Resend: ${errorDetail}`);
  }

  console.log('[Email Service] OTP successfully sent via Resend API to', email);
  return { messageId: data.id };
};

/**
 * Send email via Nodemailer (SMTP - Gmail).
 * Note: Free cloud tiers (like Render Free) block outbound SMTP ports 25, 465, and 587.
 */
const sendViaNodemailer = async (email, otp, htmlContent, textContent) => {
  const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: cleanPass,
    },
    // Set 10-second timeout so the server doesn't hang indefinitely if SMTP ports are blocked
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Auth Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code (OTP)',
      text: textContent,
      html: htmlContent,
    });
    console.log('[Email Service] OTP successfully sent via Gmail SMTP to', email);
    return info;
  } catch (error) {
    console.error('[Email Service - SMTP Error]', error.message);

    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.message?.includes('timeout')
    ) {
      throw new Error(
        'SMTP connection timed out. Free cloud hosting (like Render Free tier) blocks outbound SMTP ports (465/587). Please use an HTTP email API like Brevo (set BREVO_API_KEY) or Resend (set RESEND_API_KEY), or upgrade to a paid hosting tier.'
      );
    }

    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

/**
 * Sends a 6-digit OTP to the recipient's email address.
 * Automatically chooses the best delivery method available:
 * 1. Brevo REST API (if BREVO_API_KEY is present) - Best for Render Free Tier (300 free emails/day)
 * 2. Resend REST API (if RESEND_API_KEY is present) - Great for custom domains (100 free emails/day)
 * 3. Nodemailer Gmail SMTP (if EMAIL_USER & EMAIL_PASS are present) - Works locally or on paid instances
 */
const sendOTPEmail = async (email, otp) => {
  const textContent = `Your verification code is: ${otp}. This code is valid for 5 minutes. Please do not share this code with anyone.`;
  const htmlContent = `
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

  // Priority 1: Brevo HTTP API (Port 443 - zero SMTP blocking on Render)
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
    return await sendViaBrevo(email, otp, htmlContent, textContent);
  }

  // Priority 2: Resend HTTP API (Port 443 - zero SMTP blocking on Render)
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    return await sendViaResend(email, otp, htmlContent, textContent);
  }

  // Priority 3: Nodemailer Gmail SMTP (local development or paid hosting)
  if (
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_email@gmail.com'
  ) {
    return await sendViaNodemailer(email, otp, htmlContent, textContent);
  }

  const errorMsg =
    'Email service not configured. For Render/production, set BREVO_API_KEY or RESEND_API_KEY. For local development, set EMAIL_USER and EMAIL_PASS in server/.env.';
  console.error(`[Email Service] ${errorMsg}`);
  throw new Error(errorMsg);
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};

