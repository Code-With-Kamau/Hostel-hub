const express = require('express');
const db      = require('../database/db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { profileUpload, handleUploadError } = require('../middleware/upload');
const {
  validateKenyanPhone, normalizeKenyanPhone,
  validateEmail, validatePassword, passwordContainsName,
} = require('../utils/validators');
const bcrypt = require('bcrypt');

const router = express.Router();

// ── PUT /api/students/profile ──────────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, institution, course, year_of_study } = req.body;

    const updates = [];
    const values  = [];

    if (name && name.trim().length >= 2) {
      updates.push('name = ?'); values.push(name.trim());
    }
    if (phone) {
      if (!validateKenyanPhone(phone)) {
        return res.status(400).json({ error: 'Invalid Kenyan phone number' });
      }
      const normalized = normalizeKenyanPhone(phone);
      const [dup] = await db.query(
        'SELECT id FROM users WHERE phone = ? AND id != ?', [normalized, req.user.id]
      );
      if (dup.length) return res.status(409).json({ error: 'Phone number already in use' });
      updates.push('phone = ?'); values.push(normalized);
    }
    if (institution) { updates.push('institution = ?'); values.push(institution); }
    if (course)      { updates.push('course = ?');      values.push(course); }
    if (year_of_study !== undefined) {
      updates.push('year_of_study = ?'); values.push(parseInt(year_of_study) || null);
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    values.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── POST /api/students/profile/photo ──────────────────────────────────────
router.post('/profile/photo',
  authenticate,
  profileUpload.single('photo'),
  handleUploadError,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });
    try {
      const photoPath = '/uploads/profiles/' + req.file.filename;
      await db.query('UPDATE users SET profile_photo = ? WHERE id = ?', [photoPath, req.user.id]);
      return res.json({ message: 'Profile photo updated', photo: photoPath });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update photo' });
    }
  }
);

// ── GET /api/students/saved ────────────────────────────────────────────────
router.get('/saved', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.id, h.name, h.address, h.room_type, h.monthly_price, h.available_rooms,
              h.average_rating, h.nearest_institution, h.distance_to_campus,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS primary_image,
              s.created_at AS saved_at
       FROM saved_hostels s JOIN hostels h ON h.id = s.hostel_id
       WHERE s.user_id = ? AND h.status = 'approved'
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch saved hostels' });
  }
});

// ── POST /api/students/saved/:hostelId ────────────────────────────────────
router.post('/saved/:hostelId', authenticate, async (req, res) => {
  try {
    const [existing] = await db.query(
      'SELECT id FROM saved_hostels WHERE user_id = ? AND hostel_id = ?',
      [req.user.id, req.params.hostelId]
    );
    if (existing.length) {
      await db.query('DELETE FROM saved_hostels WHERE user_id = ? AND hostel_id = ?',
        [req.user.id, req.params.hostelId]);
      return res.json({ saved: false, message: 'Hostel removed from saved' });
    } else {
      await db.query('INSERT INTO saved_hostels (user_id, hostel_id) VALUES (?, ?)',
        [req.user.id, req.params.hostelId]);
      return res.json({ saved: true, message: 'Hostel saved' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle saved hostel' });
  }
});

// ── GET /api/students/roommates ────────────────────────────────────────────
router.get('/roommates', optionalAuth, async (req, res) => {
  try {
    const { institution, gender, page = 1, limit = 20 } = req.query;
    const conditions = ['r.is_active = 1'];
    const params     = [];

    if (institution) { conditions.push('r.institution LIKE ?'); params.push(`%${institution}%`); }
    if (gender)      { conditions.push('r.gender = ?'); params.push(gender); }

    const where  = conditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT r.*, u.name, u.profile_photo, u.institution, u.course, u.year_of_study
       FROM roommate_requests r JOIN users u ON u.id = r.student_id
       WHERE ${where}
       ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch roommate requests' });
  }
});

// ── POST /api/students/roommates ───────────────────────────────────────────
router.post('/roommates', authenticate, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can post roommate requests' });
  }
  try {
    const { gender, preferred_gender, min_budget, max_budget, move_in_date, bio } = req.body;
    if (!gender) return res.status(400).json({ error: 'gender is required' });

    await db.query(
      `INSERT INTO roommate_requests (student_id, gender, preferred_gender, institution, course, min_budget, max_budget, move_in_date, bio, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE gender=VALUES(gender), preferred_gender=VALUES(preferred_gender),
         institution=VALUES(institution), course=VALUES(course), min_budget=VALUES(min_budget),
         max_budget=VALUES(max_budget), move_in_date=VALUES(move_in_date), bio=VALUES(bio), is_active=1`,
      [req.user.id, gender, preferred_gender || 'any',
       req.user.institution, req.user.course,
       min_budget || null, max_budget || null, move_in_date || null, bio || null]
    );
    return res.json({ message: 'Roommate request posted successfully' });
  } catch (err) {
    console.error('Post roommate error:', err);
    return res.status(500).json({ error: 'Failed to post roommate request' });
  }
});

// ── DELETE /api/students/roommates/mine ───────────────────────────────────
router.delete('/roommates/mine', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE roommate_requests SET is_active = 0 WHERE student_id = ?', [req.user.id]
    );
    return res.json({ message: 'Roommate request deactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to deactivate request' });
  }
});

// ── GET /api/students/study-buddies ───────────────────────────────────────
router.get('/study-buddies', optionalAuth, async (req, res) => {
  try {
    const { institution, study_style, page = 1, limit = 20 } = req.query;
    const conditions = ['r.is_active = 1'];
    const params     = [];

    if (institution)  { conditions.push('r.institution LIKE ?');  params.push(`%${institution}%`); }
    if (study_style)  { conditions.push('r.study_style = ?');     params.push(study_style); }

    const where  = conditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT r.*, u.name, u.profile_photo, u.institution, u.course
       FROM study_buddy_requests r JOIN users u ON u.id = r.student_id
       WHERE ${where}
       ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch study buddy requests' });
  }
});

// ── POST /api/students/study-buddies ──────────────────────────────────────
router.post('/study-buddies', authenticate, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can post study buddy requests' });
  }
  try {
    const { subjects, study_style, preferred_times, bio } = req.body;
    if (!subjects) return res.status(400).json({ error: 'subjects is required' });

    await db.query(
      `INSERT INTO study_buddy_requests (student_id, subjects, study_style, preferred_times, institution, bio, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE subjects=VALUES(subjects), study_style=VALUES(study_style),
         preferred_times=VALUES(preferred_times), bio=VALUES(bio), is_active=1`,
      [req.user.id, subjects, study_style || 'any', preferred_times || null, req.user.institution, bio || null]
    );
    return res.json({ message: 'Study buddy request posted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to post study buddy request' });
  }
});

// ── GET /api/students/amenities/:hostelId ─────────────────────────────────
router.get('/amenities/:hostelId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM nearby_amenities WHERE hostel_id = ? ORDER BY distance_m ASC',
      [req.params.hostelId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch amenities' });
  }
});

// ── POST /api/students/amenities/:hostelId ────────────────────────────────
router.post('/amenities/:hostelId', authenticate, async (req, res) => {
  try {
    const [hostel] = await db.query(
      'SELECT id, owner_id FROM hostels WHERE id = ?', [req.params.hostelId]
    );
    if (!hostel.length) return res.status(404).json({ error: 'Hostel not found' });
    if (hostel[0].owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { category, name, distance_m } = req.body;
    if (!category || !name) return res.status(400).json({ error: 'category and name are required' });

    await db.query(
      'INSERT INTO nearby_amenities (hostel_id, category, name, distance_m) VALUES (?, ?, ?, ?)',
      [req.params.hostelId, category, name, distance_m || 0]
    );
    return res.json({ message: 'Amenity added successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add amenity' });
  }
});

module.exports = router;
