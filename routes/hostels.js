const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { hostelUpload } = require('../middleware/upload');

// Haversine distance (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET all hostels with filters
router.get('/all', optionalAuth, async (req, res) => {
  try {
    const { search, institution, room_type, min_price, max_price, county, gender_policy,
      allows_roommates, wifi, meals_provided, study_friendly, security, backup_power,
      lat, lng, radius = 10, sort = 'newest', page = 1, limit = 12 } = req.query;

    let where = ['h.is_approved=1', "h.status != 'unlisted'"];
    const vals = [];

    if (search) { where.push('(h.title LIKE ? OR h.location LIKE ? OR h.nearest_institution LIKE ?)'); vals.push(...Array(3).fill(`%${search}%`)); }
    if (institution) { where.push('h.nearest_institution LIKE ?'); vals.push(`%${institution}%`); }
    if (room_type) { where.push('h.room_type=?'); vals.push(room_type); }
    if (min_price) { where.push('h.price_per_month>=?'); vals.push(min_price); }
    if (max_price) { where.push('h.price_per_month<=?'); vals.push(max_price); }
    if (county) { where.push('h.county=?'); vals.push(county); }
    if (gender_policy) { where.push('(h.gender_policy=? OR h.gender_policy="any")'); vals.push(gender_policy); }
    if (allows_roommates === 'true') { where.push('h.allows_roommates=1'); }
    if (wifi === 'true') { where.push('h.wifi=1'); }
    if (meals_provided === 'true') { where.push('h.meals_provided=1'); }
    if (study_friendly === 'true') { where.push('h.study_friendly=1'); }
    if (security === 'true') { where.push('h.security=1'); }
    if (backup_power === 'true') { where.push('h.backup_power=1'); }

    const orderMap = {
      newest: 'h.created_at DESC', price_asc: 'h.price_per_month ASC',
      price_desc: 'h.price_per_month DESC', popular: 'h.views_count DESC',
      rating: 'h.avg_rating DESC', distance: 'h.distance_to_campus ASC',
    };
    const orderBy = orderMap[sort] || 'h.created_at DESC';
    const offset = (page - 1) * limit;
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM hostels h ${whereStr}`, vals);
    const total = countRows[0].total;

    const [rows] = await db.execute(`
      SELECT h.*, u.name as owner_name, u.phone as owner_phone,
        (SELECT image_url FROM hostel_images WHERE hostel_id=h.id AND is_primary=1 LIMIT 1) as primary_image,
        ${req.user ? `(SELECT COUNT(*) FROM saved_hostels WHERE user_id=${req.user.id} AND hostel_id=h.id) as is_saved,` : '0 as is_saved,'}
        h.available_rooms > 0 as has_vacancy
      FROM hostels h JOIN users u ON h.owner_id=u.id
      ${whereStr} ORDER BY h.is_featured DESC, ${orderBy}
      LIMIT ${parseInt(limit)} OFFSET ${offset}`, vals);

    let data = rows;
    if (lat && lng) {
      data = rows.map(h => ({
        ...h,
        distance: h.latitude ? haversine(parseFloat(lat), parseFloat(lng), h.latitude, h.longitude) : null
      })).filter(h => !h.distance || h.distance <= parseFloat(radius))
        .sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    res.json({ success: true, data, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// GET single hostel
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT h.*, u.name as owner_name, u.phone as owner_phone, u.email as owner_email, u.profile_photo as owner_photo,
        ${req.user ? `(SELECT COUNT(*) FROM saved_hostels WHERE user_id=${req.user.id} AND hostel_id=h.id) as is_saved` : '0 as is_saved'}
      FROM hostels h JOIN users u ON h.owner_id=u.id WHERE h.id=?`, [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Hostel not found' });
    const hostel = rows[0];
    const [images] = await db.execute('SELECT * FROM hostel_images WHERE hostel_id=? ORDER BY is_primary DESC', [req.params.id]);
    const [reviews] = await db.execute(`
      SELECT r.*, u.name as student_name, u.profile_photo as student_photo, u.institution, u.course
      FROM reviews r JOIN users u ON r.student_id=u.id WHERE r.hostel_id=? ORDER BY r.created_at DESC LIMIT 10`, [req.params.id]);
    const [amenities] = await db.execute('SELECT * FROM nearby_amenities WHERE hostel_id=? ORDER BY distance_m ASC', [req.params.id]);

    await db.execute('UPDATE hostels SET views_count=views_count+1 WHERE id=?', [req.params.id]);
    res.json({ success: true, data: { ...hostel, images, reviews, amenities } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// POST add hostel (owner/admin)
router.post('/add', authenticateToken, requireRole('owner', 'admin'), hostelUpload.array('images', 10), async (req, res) => {
  try {
    const f = req.body;
    const [result] = await db.execute(`
      INSERT INTO hostels (owner_id,title,description,location,county,sub_county,latitude,longitude,
        nearest_institution,distance_to_campus,room_type,price_per_month,deposit_amount,
        total_rooms,available_rooms,allows_roommates,max_roommates,gender_policy,study_friendly,
        wifi,wifi_speed,meals_provided,meals_description,water_supply,electricity,backup_power,
        security,cctv,caretaker,laundry,common_room,kitchen_access,fridge_access,cleaning_service,
        no_alcohol,no_smoking,visitors_allowed,curfew_time,rules)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, f.title, f.description||null, f.location, f.county||null, f.sub_county||null,
       f.lat||null, f.lng||null, f.nearest_institution||null, f.distance_to_campus||null,
       f.room_type||'single', f.price_per_month, f.deposit_amount||f.price_per_month,
       f.total_rooms||1, f.available_rooms||f.total_rooms||1,
       f.allows_roommates==='true'?1:0, f.max_roommates||2, f.gender_policy||'any',
       f.study_friendly==='true'?1:0, f.wifi==='true'?1:0, f.wifi_speed||null,
       f.meals_provided==='true'?1:0, f.meals_description||null, f.water_supply||'piped',
       f.electricity!=='false'?1:0, f.backup_power==='true'?1:0,
       f.security==='true'?1:0, f.cctv==='true'?1:0, f.caretaker==='true'?1:0,
       f.laundry==='true'?1:0, f.common_room==='true'?1:0, f.kitchen_access==='true'?1:0,
       f.fridge_access==='true'?1:0, f.cleaning_service==='true'?1:0,
       f.no_alcohol==='true'?1:0, f.no_smoking==='true'?1:0, f.visitors_allowed!=='false'?1:0,
       f.curfew_time||null, f.rules||null]);

    const hostelId = result.insertId;
    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++) {
        await db.execute('INSERT INTO hostel_images (hostel_id,image_url,is_primary) VALUES (?,?,?)',
          [hostelId, '/uploads/hostels/' + req.files[i].filename, i === 0 ? 1 : 0]);
      }
    }
    // Add nearby amenities if provided
    if (f.amenities_json) {
      const amenities = JSON.parse(f.amenities_json);
      for (const a of amenities) {
        await db.execute('INSERT INTO nearby_amenities (hostel_id,name,category,distance_m) VALUES (?,?,?,?)',
          [hostelId, a.name, a.category, a.distance_m]);
      }
    }

    await db.execute(`INSERT INTO notifications (user_id,title,message,type) VALUES (1,?,?,?)`,
      ['New Hostel Submitted', `${req.user.name} submitted "${f.title}" for approval`, 'hostel']);

    res.json({ success: true, message: 'Hostel submitted for approval! We will review within 24hrs.', id: hostelId });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// PUT update hostel
router.put('/:id', authenticateToken, hostelUpload.array('images', 10), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM hostels WHERE id=?', [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Not found' });
    if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.json({ success: false, message: 'Not authorized' });
    const f = req.body;
    await db.execute(`UPDATE hostels SET title=?,description=?,location=?,county=?,price_per_month=?,
      room_type=?,allows_roommates=?,max_roommates=?,gender_policy=?,study_friendly=?,available_rooms=?,
      wifi=?,meals_provided=?,meals_description=?,security=?,backup_power=?,rules=?,curfew_time=? WHERE id=?`,
      [f.title, f.description||null, f.location, f.county||null, f.price_per_month,
       f.room_type||'single', f.allows_roommates==='true'?1:0, f.max_roommates||2,
       f.gender_policy||'any', f.study_friendly==='true'?1:0, f.available_rooms||0,
       f.wifi==='true'?1:0, f.meals_provided==='true'?1:0, f.meals_description||null,
       f.security==='true'?1:0, f.backup_power==='true'?1:0, f.rules||null, f.curfew_time||null,
       req.params.id]);
    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++)
        await db.execute('INSERT INTO hostel_images (hostel_id,image_url,is_primary) VALUES (?,?,0)',
          [req.params.id, '/uploads/hostels/' + req.files[i].filename]);
    }
    res.json({ success: true, message: 'Hostel updated' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// DELETE hostel
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT owner_id FROM hostels WHERE id=?', [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Not found' });
    if (rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
      return res.json({ success: false, message: 'Not authorized' });
    await db.execute('DELETE FROM hostels WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Hostel deleted' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// GET owner's hostels
router.get('/owner/my', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT h.*, (SELECT image_url FROM hostel_images WHERE hostel_id=h.id AND is_primary=1 LIMIT 1) as primary_image,
        (SELECT COUNT(*) FROM bookings WHERE hostel_id=h.id) as bookings_count
      FROM hostels h WHERE h.owner_id=? ORDER BY h.created_at DESC`, [req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Toggle save
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const [exists] = await db.execute('SELECT id FROM saved_hostels WHERE user_id=? AND hostel_id=?', [req.user.id, req.params.id]);
    if (exists.length) {
      await db.execute('DELETE FROM saved_hostels WHERE user_id=? AND hostel_id=?', [req.user.id, req.params.id]);
      res.json({ success: true, saved: false, message: 'Removed from saved' });
    } else {
      await db.execute('INSERT INTO saved_hostels (user_id,hostel_id) VALUES (?,?)', [req.user.id, req.params.id]);
      res.json({ success: true, saved: true, message: 'Hostel saved!' });
    }
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// GET saved hostels
router.get('/saved/list', authenticateToken, async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT h.*, (SELECT image_url FROM hostel_images WHERE hostel_id=h.id AND is_primary=1 LIMIT 1) as primary_image
      FROM saved_hostels s JOIN hostels h ON s.hostel_id=h.id WHERE s.user_id=? ORDER BY s.created_at DESC`, [req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// POST review
router.post('/:id/review', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { rating, review_text } = req.body;
    await db.execute(`INSERT INTO reviews (hostel_id,student_id,rating,review_text) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE rating=VALUES(rating), review_text=VALUES(review_text)`,
      [req.params.id, req.user.id, rating, review_text || null]);
    await db.execute(`UPDATE hostels SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE hostel_id=?),
      review_count=(SELECT COUNT(*) FROM reviews WHERE hostel_id=?) WHERE id=?`,
      [req.params.id, req.params.id, req.params.id]);
    res.json({ success: true, message: 'Review submitted!' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
