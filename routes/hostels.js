const express = require('express');
const db      = require('../database/db');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { hostelUpload, handleUploadError } = require('../middleware/upload');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// ── Helper: build hostel query filters ────────────────────────────────────
function buildFilters(query) {
  const conditions = ['h.status = "approved"'];
  const params     = [];

  if (query.search) {
    conditions.push('(h.name LIKE ? OR h.address LIKE ? OR h.nearest_institution LIKE ?)');
    const s = `%${query.search}%`;
    params.push(s, s, s);
  }
  if (query.room_type)     { conditions.push('h.room_type = ?');     params.push(query.room_type); }
  if (query.gender_policy) { conditions.push('h.gender_policy = ?'); params.push(query.gender_policy); }
  if (query.min_price)     { conditions.push('h.monthly_price >= ?'); params.push(Number(query.min_price)); }
  if (query.max_price)     { conditions.push('h.monthly_price <= ?'); params.push(Number(query.max_price)); }
  if (query.wifi === 'true')             { conditions.push('h.wifi = 1'); }
  if (query.meals_provided === 'true')   { conditions.push('h.meals_provided = 1'); }
  if (query.study_friendly === 'true')   { conditions.push('h.study_friendly = 1'); }
  if (query.available === 'true')        { conditions.push('h.available_rooms > 0'); }
  if (query.institution) {
    conditions.push('h.nearest_institution LIKE ?');
    params.push(`%${query.institution}%`);
  }

  return { conditions, params };
}

// ── GET /api/hostels ───────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query);
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '12')));
    const offset = (page - 1) * limit;

    const sortMap = {
      price_asc:    'h.monthly_price ASC',
      price_desc:   'h.monthly_price DESC',
      rating:       'h.average_rating DESC',
      newest:       'h.created_at DESC',
      distance:     'h.distance_to_campus ASC',
    };
    const orderBy = sortMap[req.query.sort] || 'h.created_at DESC';

    const where = conditions.join(' AND ');

    const [hostels] = await db.query(
      `SELECT h.id, h.name, h.address, h.county, h.room_type, h.gender_policy,
              h.monthly_price, h.deposit_amount, h.available_rooms, h.total_rooms,
              h.wifi, h.meals_provided, h.study_friendly, h.security, h.backup_power,
              h.nearest_institution, h.distance_to_campus, h.average_rating, h.total_reviews,
              h.latitude, h.longitude, h.created_at,
              u.name AS owner_name, u.phone AS owner_phone,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS primary_image
       FROM hostels h
       JOIN users u ON u.id = h.owner_id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM hostels h WHERE ${where}`,
      params
    );

    return res.json({
      hostels,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });

  } catch (err) {
    console.error('Get hostels error:', err);
    return res.status(500).json({ error: 'Failed to fetch hostels' });
  }
});

// ── GET /api/hostels/:id ───────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
       FROM hostels h
       JOIN users u ON u.id = h.owner_id
       WHERE h.id = ? AND h.status = 'approved'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });

    const hostel = rows[0];

    const [images]    = await db.query('SELECT * FROM hostel_images WHERE hostel_id = ?', [hostel.id]);
    const [amenities] = await db.query('SELECT * FROM nearby_amenities WHERE hostel_id = ?', [hostel.id]);
    const [reviews]   = await db.query(
      `SELECT r.*, u.name AS student_name, u.profile_photo
       FROM reviews r JOIN users u ON u.id = r.student_id
       WHERE r.hostel_id = ? ORDER BY r.created_at DESC LIMIT 20`,
      [hostel.id]
    );

    // Saved status for logged-in users
    let isSaved = false;
    if (req.user) {
      const [saved] = await db.query(
        'SELECT id FROM saved_hostels WHERE user_id = ? AND hostel_id = ?',
        [req.user.id, hostel.id]
      );
      isSaved = saved.length > 0;
    }

    return res.json({ ...hostel, images, amenities, reviews, isSaved });

  } catch (err) {
    console.error('Get hostel error:', err);
    return res.status(500).json({ error: 'Failed to fetch hostel' });
  }
});

// ── POST /api/hostels ──────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only hostel owners can create listings' });
  }

  const conn = await db.getConnection();
  try {
    const {
      name, description, address, county, latitude, longitude,
      nearest_institution, distance_to_campus, room_type, gender_policy,
      monthly_price, deposit_amount, total_rooms, wifi, meals_provided,
      meals_description, study_friendly, security, backup_power,
      allows_roommates, curfew_time, wifi_speed,
    } = req.body;

    if (!name || !address || !room_type || !monthly_price || !deposit_amount || !total_rooms) {
      return res.status(400).json({ error: 'name, address, room_type, monthly_price, deposit_amount and total_rooms are required' });
    }

    if (Number(monthly_price) <= 0 || Number(deposit_amount) <= 0) {
      return res.status(400).json({ error: 'Price and deposit must be positive numbers' });
    }

    if (Number(total_rooms) < 1) {
      return res.status(400).json({ error: 'Total rooms must be at least 1' });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO hostels (owner_id, name, description, address, county, latitude, longitude,
        nearest_institution, distance_to_campus, room_type, gender_policy,
        monthly_price, deposit_amount, total_rooms, available_rooms,
        wifi, meals_provided, meals_description, study_friendly, security,
        backup_power, allows_roommates, curfew_time, wifi_speed, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?)`,
      [
        req.user.id, name, description || null, address, county || null,
        latitude || null, longitude || null, nearest_institution || null,
        distance_to_campus || null, room_type, gender_policy || 'any',
        monthly_price, deposit_amount, total_rooms, total_rooms,
        wifi ? 1 : 0, meals_provided ? 1 : 0, meals_description || null,
        study_friendly ? 1 : 0, security ? 1 : 0, backup_power ? 1 : 0,
        allows_roommates ? 1 : 0, curfew_time || null, wifi_speed || null,
        req.user.role === 'admin' ? 'approved' : 'pending',
      ]
    );

    const hostelId = result.insertId;

    // Amenities
    if (Array.isArray(req.body.amenities)) {
      for (const a of req.body.amenities) {
        if (a.category && a.name) {
          await conn.query(
            'INSERT INTO nearby_amenities (hostel_id, category, name, distance_m) VALUES (?, ?, ?, ?)',
            [hostelId, a.category, a.name, a.distance_m || 0]
          );
        }
      }
    }

    await conn.commit();

    return res.status(201).json({
      message: req.user.role === 'admin'
        ? 'Hostel created and approved'
        : 'Hostel submitted for review. You will be notified once approved.',
      hostelId,
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Create hostel error:', err);
    return res.status(500).json({ error: 'Failed to create hostel' });
  } finally {
    conn.release();
  }
});

// ── POST /api/hostels/:id/images ───────────────────────────────────────────
router.post('/:id/images',
  authenticate,
  hostelUpload.array('images', 10),
  handleUploadError,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        'SELECT id, owner_id FROM hostels WHERE id = ?', [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });
      if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not your hostel' });
      }

      if (!req.files || !req.files.length) {
        return res.status(400).json({ error: 'No images provided' });
      }

      const [existingImages] = await db.query(
        'SELECT COUNT(*) AS cnt FROM hostel_images WHERE hostel_id = ?', [req.params.id]
      );
      const hasPrimary = existingImages[0].cnt === 0;

      for (let i = 0; i < req.files.length; i++) {
        const imagePath = '/uploads/hostels/' + req.files[i].filename;
        await db.query(
          'INSERT INTO hostel_images (hostel_id, image_path, is_primary) VALUES (?, ?, ?)',
          [req.params.id, imagePath, hasPrimary && i === 0 ? 1 : 0]
        );
      }

      return res.json({ message: `${req.files.length} image(s) uploaded successfully` });
    } catch (err) {
      console.error('Upload images error:', err);
      return res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

// ── PUT /api/hostels/:id ───────────────────────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hostels WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });

    const hostel = rows[0];
    if (hostel.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this hostel' });
    }

    const fields = [
      'name','description','address','county','latitude','longitude',
      'nearest_institution','distance_to_campus','room_type','gender_policy',
      'monthly_price','deposit_amount','total_rooms','wifi','meals_provided',
      'meals_description','study_friendly','security','backup_power',
      'allows_roommates','curfew_time','wifi_speed',
    ];

    const updates = [];
    const values  = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    values.push(req.params.id);
    await db.query(`UPDATE hostels SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ message: 'Hostel updated successfully' });

  } catch (err) {
    console.error('Update hostel error:', err);
    return res.status(500).json({ error: 'Failed to update hostel' });
  }
});

// ── PATCH /api/hostels/:id/status (admin only) ─────────────────────────────
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
  }

  try {
    const [rows] = await db.query('SELECT id FROM hostels WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });

    await db.query('UPDATE hostels SET status = ? WHERE id = ?', [status, req.params.id]);

    await db.query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, `hostel_${status}`, 'hostel', req.params.id, `Hostel status changed to ${status}`]
    );

    return res.json({ message: `Hostel ${status} successfully` });

  } catch (err) {
    console.error('Update hostel status error:', err);
    return res.status(500).json({ error: 'Failed to update hostel status' });
  }
});

// ── DELETE /api/hostels/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, owner_id FROM hostels WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });
    if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const [activeBookings] = await db.query(
      "SELECT id FROM bookings WHERE hostel_id = ? AND status IN ('pending','confirmed') LIMIT 1",
      [req.params.id]
    );
    if (activeBookings.length) {
      return res.status(400).json({ error: 'Cannot delete hostel with active bookings' });
    }

    await db.query('DELETE FROM hostels WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Hostel deleted successfully' });

  } catch (err) {
    console.error('Delete hostel error:', err);
    return res.status(500).json({ error: 'Failed to delete hostel' });
  }
});

// ── POST /api/hostels/:id/reviews ─────────────────────────────────────────
router.post('/:id/reviews', authenticate, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can leave reviews' });
  }

  const { rating, comment } = req.body;
  const ratingNum = parseInt(rating);

  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const conn = await db.getConnection();
  try {
    const [hostel] = await db.query(
      "SELECT id FROM hostels WHERE id = ? AND status = 'approved'", [req.params.id]
    );
    if (!hostel.length) return res.status(404).json({ error: 'Hostel not found' });

    // Must have a completed/released booking to review
    const [booking] = await db.query(
      "SELECT id FROM bookings WHERE hostel_id = ? AND student_id = ? AND status IN ('confirmed','released') LIMIT 1",
      [req.params.id, req.user.id]
    );
    if (!booking.length) {
      return res.status(403).json({ error: 'You can only review a hostel you have stayed in' });
    }

    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO reviews (hostel_id, student_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [req.params.id, req.user.id, ratingNum, comment || null]
    );

    // Recalculate average
    await conn.query(
      `UPDATE hostels h SET
         average_rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE hostel_id = h.id),
         total_reviews  = (SELECT COUNT(*) FROM reviews WHERE hostel_id = h.id)
       WHERE h.id = ?`,
      [req.params.id]
    );

    await conn.commit();
    return res.json({ message: 'Review submitted successfully' });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Review error:', err);
    return res.status(500).json({ error: 'Failed to submit review' });
  } finally {
    conn.release();
  }
});

// ── GET /api/hostels/owner/my-hostels ─────────────────────────────────────
router.get('/owner/my-hostels', authenticate, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only owners can view their listings' });
  }

  try {
    const [rows] = await db.query(
      `SELECT h.*,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS primary_image,
              (SELECT COUNT(*) FROM bookings WHERE hostel_id = h.id AND status = 'confirmed') AS active_bookings
       FROM hostels h
       WHERE h.owner_id = ?
       ORDER BY h.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('My hostels error:', err);
    return res.status(500).json({ error: 'Failed to fetch your hostels' });
  }
});

module.exports = router;
