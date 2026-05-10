const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../database/db');
const { authenticate } = require('../middleware/auth');
const {
  validateEmail,
  validateKenyanPhone,
  normalizeKenyanPhone,
  validatePassword,
  passwordContainsName,
} = require('../utils/validators');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../config/email');

const router = express.Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const conn = await db.getConnection();
  try {
    let { name, email, phone, password, role, institution, course, year_of_study } = req.body;

    // ── Field presence ──────────────────────────────────────────────────────
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ error: 'All fields (name, email, phone, password, role) are required' });
    }

    // ── Role whitelist ──────────────────────────────────────────────────────
    const allowedRoles = ['student', 'owner', 'university'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be student, owner, or university' });
    }

    // ── Name ───────────────────────────────────────────────────────────────
    name = name.trim();
    if (name.length < 2 || name.length > 150) {
      return res.status(400).json({ error: 'Name must be between 2 and 150 characters' });
    }

    // ── Email ──────────────────────────────────────────────────────────────
    email = email.trim().toLowerCase();
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. example@gmail.com)' });
    }

    // ── Phone ──────────────────────────────────────────────────────────────
    if (!validateKenyanPhone(phone)) {
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678)' });
    }
    phone = normalizeKenyanPhone(phone);

    // ── Password ───────────────────────────────────────────────────────────
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.message });
    }
    if (passwordContainsName(password, name)) {
      return res.status(400).json({ error: 'Password must not contain your name' });
    }

    // ── Duplicate check ────────────────────────────────────────────────────
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'An account with that email or phone already exists' });
    }

    // ── Student-specific fields ────────────────────────────────────────────
    if (role === 'student') {
      if (!institution) return res.status(400).json({ error: 'Institution is required for students' });
      if (!course)      return res.status(400).json({ error: 'Course is required for students' });
      year_of_study = parseInt(year_of_study) || null;
    }

    // ── Hash password ──────────────────────────────────────────────────────
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    await conn.beginTransaction();

    // ── Insert user ────────────────────────────────────────────────────────
    const [result] = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, role, institution, course, year_of_study)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, password_hash, role, institution || null, course || null, year_of_study || null]
    );
    const userId = result.insertId;

    // ── University profile ─────────────────────────────────────────────────
    if (role === 'university') {
      const universityName = req.body.university_name || name;
      await conn.query(
        'INSERT INTO university_profiles (user_id, university_name) VALUES (?, ?)',
        [userId, universityName]
      );
    }

    // ── Email verification token ───────────────────────────────────────────
    const verifyToken  = crypto.randomBytes(48).toString('hex');
    const tokenExpiry  = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await conn.query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, verifyToken, tokenExpiry]
    );

    await conn.commit();

    // ── Send verification email (non-blocking) ─────────────────────────────
    sendVerificationEmail(email, name, verifyToken).catch(err =>
      console.error('Failed to send verification email:', err.message)
    );

    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    conn.release();
  }
});

// ── GET /api/auth/verify-email?token=XXX ──────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Verification token is required' });

  try {
    const [rows] = await db.query(
      `SELECT ev.*, u.name FROM email_verifications ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.token = ? AND ev.used = 0 AND ev.expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired. Please request a new one.' });
    }

    const ev = rows[0];
    await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [ev.user_id]);
    await db.query('UPDATE email_verifications SET used = 1 WHERE id = ?', [ev.id]);

    return res.json({ message: `Email verified! Welcome to HostelHub, ${ev.name}. You can now log in.` });

  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── POST /api/auth/resend-verification ────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, email_verified FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (!rows.length || rows[0].email_verified) {
      return res.json({ message: 'If an unverified account exists with that email, a new link has been sent.' });
    }

    const user = rows[0];

    // Invalidate old tokens
    await db.query('UPDATE email_verifications SET used = 1 WHERE user_id = ?', [user.id]);

    const verifyToken = crypto.randomBytes(48).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, verifyToken, tokenExpiry]
    );

    sendVerificationEmail(user.email, user.name, verifyToken).catch(err =>
      console.error('Resend verification error:', err.message)
    );

    return res.json({ message: 'If an unverified account exists with that email, a new link has been sent.' });

  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ error: 'Failed to resend verification email.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support at support@hostelhub.co.ke' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        unverified: true,
        email: user.email,
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({
      token,
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        role:         user.role,
        institution:  user.institution,
        course:       user.course,
        year_of_study: user.year_of_study,
        profile_photo: user.profile_photo,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always return the same message to prevent email enumeration
  const successMsg = 'If an account with that email exists, a password reset link has been sent.';

  try {
    const [rows] = await db.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!rows.length) return res.json({ message: successMsg });

    const user = rows[0];

    // Invalidate existing tokens
    await db.query('UPDATE password_resets SET used = 1 WHERE user_id = ?', [user.id]);

    const resetToken  = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, tokenExpiry]
    );

    sendPasswordResetEmail(user.email, user.name, resetToken).catch(err =>
      console.error('Password reset email error:', err.message)
    );

    return res.json({ message: successMsg });

  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const [rows] = await db.query(
      `SELECT pr.*, u.name FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    const reset = rows[0];

    // Password validation
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.message });
    }

    if (passwordContainsName(password, reset.name)) {
      return res.status(400).json({ error: 'Password must not contain your name' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, reset.user_id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    return res.json({ message: 'Password reset successful! You can now log in with your new password.' });

  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, phone, role, institution, course, year_of_study, profile_photo, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────
router.put('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  try {
    const [rows] = await db.query('SELECT password_hash, name FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const pwdCheck = validatePassword(new_password);
    if (!pwdCheck.valid) return res.status(400).json({ error: pwdCheck.message });

    if (passwordContainsName(new_password, user.name)) {
      return res.status(400).json({ error: 'Password must not contain your name' });
    }

    const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsOld) {
      return res.status(400).json({ error: 'New password must be different from your current password' });
    }

    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id]);

    return res.json({ message: 'Password changed successfully' });

  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
