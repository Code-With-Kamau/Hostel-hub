const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

// ── ROOMMATE MATCHING ──────────────────────────────
router.get('/roommates', optionalAuth, async (req, res) => {
  try {
    const { institution, gender, min_budget, max_budget, page = 1, limit = 12 } = req.query;
    let where = ['r.is_active=1']; const vals = [];
    if (institution) { where.push('r.institution LIKE ?'); vals.push(`%${institution}%`); }
    if (gender) { where.push('r.gender=?'); vals.push(gender); }
    if (min_budget) { where.push('r.budget_max>=?'); vals.push(min_budget); }
    if (max_budget) { where.push('r.budget_min<=?'); vals.push(max_budget); }
    const offset = (page - 1) * limit;
    const [data] = await db.execute(`
      SELECT r.*, u.name, u.profile_photo, u.institution as user_institution, u.course, u.year_of_study,
        h.title as preferred_hostel, h.location as hostel_location
      FROM roommate_requests r JOIN users u ON r.student_id=u.id
      LEFT JOIN hostels h ON r.hostel_id=h.id
      WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`, vals);
    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM roommate_requests r WHERE ${where.join(' AND ')}`, vals);
    res.json({ success: true, data, total: countRows[0].total });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/roommates', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { hostel_id, institution, course, year_of_study, gender, preferred_gender,
      budget_min, budget_max, move_in_date, bio } = req.body;
    // Deactivate old request
    await db.execute('UPDATE roommate_requests SET is_active=0 WHERE student_id=?', [req.user.id]);
    await db.execute(`INSERT INTO roommate_requests (student_id,hostel_id,institution,course,year_of_study,gender,preferred_gender,budget_min,budget_max,move_in_date,bio)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, hostel_id||null, institution, course, year_of_study||null, gender, preferred_gender||'any',
       budget_min||null, budget_max||null, move_in_date||null, bio]);
    res.json({ success: true, message: 'Roommate request posted!' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.delete('/roommates/mine', authenticateToken, async (req, res) => {
  try {
    await db.execute('UPDATE roommate_requests SET is_active=0 WHERE student_id=?', [req.user.id]);
    res.json({ success: true, message: 'Request deactivated' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ── STUDY BUDDY ────────────────────────────────────
router.get('/study-buddies', optionalAuth, async (req, res) => {
  try {
    const { institution, course, study_style, page = 1, limit = 12 } = req.query;
    let where = ['s.is_active=1']; const vals = [];
    if (institution) { where.push('s.institution LIKE ?'); vals.push(`%${institution}%`); }
    if (course) { where.push('s.course LIKE ?'); vals.push(`%${course}%`); }
    if (study_style) { where.push('s.study_style=?'); vals.push(study_style); }
    const offset = (page - 1) * limit;
    const [data] = await db.execute(`
      SELECT s.*, u.name, u.profile_photo, u.year_of_study as user_year
      FROM study_buddy_requests s JOIN users u ON s.student_id=u.id
      WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`, vals);
    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM study_buddy_requests s WHERE ${where.join(' AND ')}`, vals);
    res.json({ success: true, data, total: countRows[0].total });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/study-buddies', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { institution, course, year_of_study, subjects, study_style, preferred_time, bio } = req.body;
    await db.execute('UPDATE study_buddy_requests SET is_active=0 WHERE student_id=?', [req.user.id]);
    await db.execute(`INSERT INTO study_buddy_requests (student_id,institution,course,year_of_study,subjects,study_style,preferred_time,bio)
      VALUES (?,?,?,?,?,?,?,?)`,
      [req.user.id, institution, course, year_of_study||null, subjects||null, study_style||'any', preferred_time||null, bio||null]);
    res.json({ success: true, message: 'Study buddy request posted!' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ── NEARBY AMENITIES ───────────────────────────────
router.get('/amenities/:hostelId', async (req, res) => {
  try {
    const [data] = await db.execute('SELECT * FROM nearby_amenities WHERE hostel_id=? ORDER BY distance_m', [req.params.hostelId]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/amenities/:hostelId', authenticateToken, async (req, res) => {
  try {
    const { name, category, distance_m, latitude, longitude } = req.body;
    await db.execute('INSERT INTO nearby_amenities (hostel_id,name,category,distance_m,latitude,longitude) VALUES (?,?,?,?,?,?)',
      [req.params.hostelId, name, category||'other', distance_m||0, latitude||null, longitude||null]);
    res.json({ success: true, message: 'Amenity added' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
