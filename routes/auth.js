const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { profileUpload } = require('../middleware/upload');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role = 'student',
      institution, course, year_of_study, student_id } = req.body;
    if (!name || !email || !password) return res.json({ success: false, message: 'Name, email and password required' });
    const [exists] = await db.execute('SELECT id FROM users WHERE email=?', [email]);
    if (exists.length) return res.json({ success: false, message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    await db.execute(
      `INSERT INTO users (uuid,name,email,phone,password,role,institution,course,year_of_study,student_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuidv4(), name, email, phone || null, hash, role, institution || null, course || null, year_of_study || 1, student_id || null]
    );
    res.json({ success: true, message: 'Account created! Please sign in.' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
    if (!rows.length) return res.json({ success: false, message: 'Invalid email or password' });
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password))
      return res.json({ success: false, message: 'Invalid email or password' });
    await db.execute('UPDATE users SET last_login=NOW() WHERE id=?', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.json({ success: false, message: 'User not found' });
    const { password: _, ...user } = rows[0];
    res.json({ success: true, data: user });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Update profile
router.put('/profile', authenticateToken, profileUpload.single('profile_photo'), async (req, res) => {
  try {
    const { name, phone, institution, course, year_of_study, student_id } = req.body;
    const photo = req.file ? '/uploads/profiles/' + req.file.filename : null;
    const updates = []; const vals = [];
    if (name) { updates.push('name=?'); vals.push(name); }
    if (phone) { updates.push('phone=?'); vals.push(phone); }
    if (institution !== undefined) { updates.push('institution=?'); vals.push(institution); }
    if (course !== undefined) { updates.push('course=?'); vals.push(course); }
    if (year_of_study) { updates.push('year_of_study=?'); vals.push(year_of_study); }
    if (student_id) { updates.push('student_id=?'); vals.push(student_id); }
    if (photo) { updates.push('profile_photo=?'); vals.push(photo); }
    if (!updates.length) return res.json({ success: false, message: 'Nothing to update' });
    vals.push(req.user.id);
    await db.execute(`UPDATE users SET ${updates.join(',')} WHERE id=?`, vals);
    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    const { password: _, ...user } = rows[0];
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
