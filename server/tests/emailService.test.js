const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { generateOTP, sendOtpEmail } = require('../utils/emailService');

describe('Email Service - Brevo HTTP API', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset env vars before each test
    process.env = { ...originalEnv };
    process.env.BREVO_API_KEY = 'test_brevo_api_key_12345';
    process.env.BREVO_SENDER_EMAIL = 'support@example.com';
    process.env.BREVO_SENDER_NAME = 'Auth-Jarvis';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  describe('generateOTP', () => {
    test('should generate a 6-digit numeric string', () => {
      const otp = generateOTP();
      assert.equal(typeof otp, 'string');
      assert.equal(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
    });

    test('should generate distinct cryptographically random values', () => {
      const otps = new Set();
      for (let i = 0; i < 20; i++) {
        otps.add(generateOTP());
      }
      // Out of 20 random 6-digit numbers, virtually all should be unique
      assert.ok(otps.size >= 18);
    });
  });

  describe('sendOtpEmail - Input Validation', () => {
    test('should throw error when email is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await sendOtpEmail('', '123456');
        },
        {
          name: 'Error',
          message: 'Recipient email is required.',
        }
      );
    });

    test('should throw error when OTP is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await sendOtpEmail('user@example.com', '');
        },
        {
          name: 'Error',
          message: 'OTP is required.',
        }
      );
    });
  });

  describe('sendOtpEmail - Missing Environment Variables', () => {
    test('should throw error when BREVO_API_KEY is missing', async () => {
      delete process.env.BREVO_API_KEY;
      await assert.rejects(
        async () => {
          await sendOtpEmail('user@example.com', '123456');
        },
        /Email service not configured/
      );
    });

    test('should throw error when BREVO_SENDER_EMAIL is missing', async () => {
      delete process.env.BREVO_SENDER_EMAIL;
      await assert.rejects(
        async () => {
          await sendOtpEmail('user@example.com', '123456');
        },
        /Email service not configured/
      );
    });
  });

  describe('sendOtpEmail - Successful API Dispatch', () => {
    test('should send POST request to Brevo API with correct headers and payload format', async () => {
      let capturedUrl = null;
      let capturedOptions = null;

      global.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<test-message-id-999@brevo.com>' }),
        };
      };

      const result = await sendOtpEmail('recipient@example.com', '789012');

      assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(capturedOptions.method, 'POST');
      assert.equal(capturedOptions.headers['api-key'], 'test_brevo_api_key_12345');
      assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
      assert.equal(capturedOptions.headers['accept'], 'application/json');

      const body = JSON.parse(capturedOptions.body);
      assert.equal(body.sender.name, 'Auth-Jarvis');
      assert.equal(body.sender.email, 'support@example.com');
      assert.deepEqual(body.to, [{ email: 'recipient@example.com' }]);
      assert.equal(body.subject, 'Your email verification OTP');
      assert.ok(body.htmlContent.includes('789012'));

      assert.deepEqual(result, {
        success: true,
        messageId: '<test-message-id-999@brevo.com>',
      });
    });
  });

  describe('sendOtpEmail - Error Handling & Network Timeouts', () => {
    test('should handle Brevo API HTTP error responses without leaking secrets', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Key not found in database', code: 'unauthorized' }),
      });

      await assert.rejects(
        async () => {
          await sendOtpEmail('user@example.com', '654321');
        },
        (err) => {
          assert.equal(err.name, 'Error');
          assert.ok(err.message.includes('Provider status: 401'));
          // Must not leak the API key or raw secret
          assert.ok(!err.message.includes('test_brevo_api_key_12345'));
          return true;
        }
      );
    });

    test('should handle network timeout gracefully', async () => {
      global.fetch = async () => {
        const timeoutError = new Error('The operation was aborted due to timeout');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      };

      await assert.rejects(
        async () => {
          await sendOtpEmail('user@example.com', '654321');
        },
        {
          name: 'Error',
          message: 'Failed to send verification email due to a connection timeout.',
        }
      );
    });
  });
});
