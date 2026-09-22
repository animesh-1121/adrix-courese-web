const crypto = require('crypto');

/**
 * Authentication Service
 * Handles user registration, login, password hashing, and validation
 */

/**
 * Hash a password using MD5
 */
function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password, hash) {
  const computedHash = hashPassword(password);
  return computedHash === hash;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (supports international formats)
 */
function validatePhone(phone) {
  // Basic validation: 7-15 digits, optional + prefix
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate password strength
 * At least 6 characters
 */
function validatePassword(password) {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validateEmail,
  validatePhone,
  validatePassword
};
