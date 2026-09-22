const express = require('express');
const { query } = require('../config/database');
const { hashPassword, verifyPassword, validateEmail, validatePhone, validatePassword } = require('../lib/services/authService');
const router = express.Router();

// POST /api/auth/register - User registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password || !name || !phone) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate phone
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Create user
    const result = await query(
      'INSERT INTO users (email, name, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, phone, role',
      [email, name, phone, passwordHash, 'STUDENT']
    );

    const user = result.rows[0];

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      authToken: user.id // In production, this would be a JWT
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - User login with password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await query(
      'SELECT id, email, name, phone, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = result.rows[0];

    // Verify password
    if (!user.password_hash) {
      return res.status(401).json({ 
        error: 'Please complete your profile or contact support',
        code: 'NO_PASSWORD'
      });
    }

    const isValidPassword = verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      authToken: user.id // In production, this would be a JWT
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authToken = req.headers['x-auth-token'];

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = authToken; // UUID token, not an integer

    const result = await query(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;