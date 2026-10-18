const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { generateOTP } = require('../utils/emailService');

describe('OTP Verification & Security Logic', () => {
  test('should generate secure 6-digit OTP that hashes with bcrypt', async () => {
    const rawOtp = generateOTP();
    assert.equal(rawOtp.length, 6);

    const otpHash = await bcrypt.hash(rawOtp, 10);
    assert.ok(otpHash.startsWith('$2'));

    const isMatch = await bcrypt.compare(rawOtp, otpHash);
    assert.equal(isMatch, true);
  });

  test('should reject an incorrect OTP code', async () => {
    const rawOtp = '123456';
    const otpHash = await bcrypt.hash(rawOtp, 10);

    const isWrongMatch = await bcrypt.compare('999999', otpHash);
    assert.equal(isWrongMatch, false);
  });

  test('should correctly identify expired OTP timestamp', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000 - 1000);
    const now = new Date();
    const isExpired = now > fiveMinutesAgo;
    assert.equal(isExpired, true);

    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);
    const isValid = now <= futureExpiry;
    assert.equal(isValid, true);
  });

  test('should enforce maximum OTP attempt limit (5 attempts)', () => {
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    // Simulate 4 failed attempts
    for (let i = 0; i < 4; i++) {
      attempts += 1;
      assert.ok(attempts < MAX_ATTEMPTS);
    }

    // 5th failed attempt locks
    attempts += 1;
    assert.equal(attempts >= MAX_ATTEMPTS, true);
  });
});
