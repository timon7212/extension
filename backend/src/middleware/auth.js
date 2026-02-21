const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware: verify JWT and attach employee to req.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      'SELECT id, email, name, role, is_active FROM employees WHERE id = $1',
      [decoded.sub]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.employee = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware: authenticate via JWT OR internal API key.
 * Used for endpoints that both the extension (JWT) and dashboard (API key) access.
 */
async function authenticateOrApiKey(req, res, next) {
  // Check for internal API key first (used by dashboard SSR)
  const apiKey = req.headers['x-api-key'];
  const internalKey = process.env.INTERNAL_API_KEY || 'outreach-internal-key';
  if (apiKey && apiKey === internalKey) {
    req.employee = { id: 'dashboard', name: 'Dashboard', role: 'admin' };
    return next();
  }

  // Fall back to JWT
  return authenticate(req, res, next);
}

/**
 * Middleware: require admin role.
 */
function requireAdmin(req, res, next) {
  if (req.employee.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, authenticateOrApiKey, requireAdmin };
