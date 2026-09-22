const { query } = require('../config/database');

/**
 * Authentication middleware for students
 * Verifies the user is authenticated via session token
 * For development, uses X-Auth-Token header
 * For production, will use JWT or session cookies
 */
function requireAuth(req, res, next) {
  // Development: Check for X-Auth-Token header
  const authToken = req.headers['x-auth-token'];
  
  if (!authToken) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // In development, the token is the user ID (UUID string)
  // In production, this would verify a JWT or session
  const userId = authToken;
  
  if (!userId) {
    return res.status(401).json({ 
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }

  // Attach user ID to request for use in route handlers
  req.userId = userId;
  next();
}

/**
 * Optional authentication middleware
 * Attaches user ID if authenticated, but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authToken = req.headers['x-auth-token'];
  
  if (authToken) {
    const userId = authToken;
    if (userId) {
      req.userId = userId;
    }
  }
  
  next();
}

/**
 * Get user by ID and attach to request
 */
async function attachUser(req, res, next) {
  if (!req.userId) {
    return next();
  }

  try {
    const result = await query(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

/**
 * Check if user has required role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  attachUser,
  requireRole
};