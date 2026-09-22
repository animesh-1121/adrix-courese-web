const { query } = require('../config/database');

/**
 * Admin authentication middleware
 * Verifies the user is authenticated and has ADMIN role
 * For development, uses X-Admin-Auth header with admin token
 * For production, will use JWT or session cookies
 */
async function requireAdmin(req, res, next) {
  // Development: Check for X-Admin-Auth header
  const adminToken = req.headers['x-admin-auth'];
  
  if (!adminToken) {
    return res.status(401).json({ 
      error: 'Admin authentication required',
      code: 'ADMIN_AUTH_REQUIRED'
    });
  }

  // In development, the token is the user ID (UUID string)
  // In production, this would verify a JWT or session
  const userId = adminToken;
  
  if (!userId) {
    return res.status(401).json({ 
      error: 'Invalid admin authentication token',
      code: 'INVALID_ADMIN_TOKEN'
    });
  }

  try {
    // Verify user exists and has ADMIN role
    const result = await query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Admin user not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Insufficient permissions. Admin role required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

module.exports = { requireAdmin };