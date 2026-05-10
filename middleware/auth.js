const jwt  = require('jsonwebtoken');
const db   = require('../database/db');

// ── Verify JWT and attach user to request ──────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, institution, course, year_of_study, profile_photo, is_banned, email_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// ── Optional auth (sets req.user if token present, but does not block) ─────
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next();
    }

    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, institution, course, year_of_study, profile_photo, is_banned, email_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length && !rows[0].is_banned) {
      req.user = rows[0];
    }
    next();
  } catch {
    next();
  }
}

// ── Role guards ────────────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

const requireStudent    = requireRole('student');
const requireOwner      = requireRole('owner', 'admin');
const requireAdmin      = requireRole('admin');
const requireUniversity = requireRole('university', 'admin');

module.exports = { authenticate, optionalAuth, requireRole, requireStudent, requireOwner, requireAdmin, requireUniversity };
