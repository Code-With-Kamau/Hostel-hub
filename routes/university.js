const express    = require('express');
const { Parser } = require('json2csv');
const PDFDoc     = require('pdfkit');
const db         = require('../database/db');
const { authenticate, requireUniversity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireUniversity);

// ── GET /api/university/dashboard ─────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
        (SELECT COUNT(*) FROM hostels WHERE status = 'approved') AS total_hostels,
        (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
        (SELECT COUNT(*) FROM users WHERE role = 'owner') AS total_owners
    `);
    return res.json(stats);
  } catch (err) {
    console.error('University dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ── GET /api/university/hostels ────────────────────────────────────────────
router.get('/hostels', async (req, res) => {
  try {
    const { search, room_type, county, page = 1, limit = 20 } = req.query;
    const conditions = ["h.status = 'approved'"];
    const params     = [];

    if (search) {
      conditions.push('(h.name LIKE ? OR h.address LIKE ? OR h.nearest_institution LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (room_type) { conditions.push('h.room_type = ?'); params.push(room_type); }
    if (county)    { conditions.push('h.county = ?');    params.push(county); }

    const where  = conditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [hostels] = await db.query(
      `SELECT h.id, h.name, h.address, h.county, h.room_type, h.gender_policy,
              h.monthly_price, h.deposit_amount, h.total_rooms, h.available_rooms,
              h.wifi, h.meals_provided, h.study_friendly, h.security,
              h.nearest_institution, h.distance_to_campus,
              h.average_rating, h.total_reviews,
              u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email,
              (SELECT COUNT(*) FROM bookings WHERE hostel_id = h.id AND status = 'confirmed') AS confirmed_bookings,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS primary_image
       FROM hostels h
       JOIN users u ON u.id = h.owner_id
       WHERE ${where}
       ORDER BY h.name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM hostels h WHERE ${where}`,
      params
    );

    return res.json({ hostels, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('University hostels error:', err);
    return res.status(500).json({ error: 'Failed to fetch hostels' });
  }
});

// ── GET /api/university/students ───────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const { search, institution, course, page = 1, limit = 30 } = req.query;
    const conditions = ["u.role = 'student'"];
    const params     = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (institution) { conditions.push('u.institution LIKE ?'); params.push(`%${institution}%`); }
    if (course)      { conditions.push('u.course LIKE ?');      params.push(`%${course}%`); }

    const where  = conditions.join(' AND ');
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [students] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.institution, u.course,
              u.year_of_study, u.created_at,
              (
                SELECT h.name FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS current_hostel,
              (
                SELECT h.address FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS hostel_address,
              (
                SELECT u2.name FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                JOIN users u2 ON u2.id = h.owner_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS hostel_owner,
              (
                SELECT u2.phone FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                JOIN users u2 ON u2.id = h.owner_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS owner_phone
       FROM users u
       WHERE ${where}
       ORDER BY u.name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${where}`,
      params
    );

    return res.json({ students, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('University students error:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ── GET /api/university/report/students ───────────────────────────────────
router.get('/report/students', async (req, res) => {
  try {
    const format = req.query.format || 'csv';

    const [students] = await db.query(
      `SELECT u.name, u.email, u.phone, u.institution, u.course, u.year_of_study,
              (
                SELECT h.name FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS current_hostel,
              (
                SELECT h.address FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS hostel_address,
              (
                SELECT u2.name FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                JOIN users u2 ON u2.id = h.owner_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS hostel_owner,
              (
                SELECT u2.phone FROM bookings b JOIN hostels h ON h.id = b.hostel_id
                JOIN users u2 ON u2.id = h.owner_id
                WHERE b.student_id = u.id AND b.status = 'confirmed'
                ORDER BY b.created_at DESC LIMIT 1
              ) AS owner_contact
       FROM users u WHERE u.role = 'student' ORDER BY u.institution, u.name`
    );

    if (format === 'pdf') {
      const doc = new PDFDoc({ margin: 30, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="university_students_${Date.now()}.pdf"`);
      doc.pipe(res);

      doc.fontSize(16).fillColor('#6c3ec0').text('HostelHub — University Student Housing Report', { align: 'center' });
      doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-KE')} | Total: ${students.length}`, { align: 'center' });
      doc.moveDown(1);

      const cols   = [110, 130, 90, 120, 100, 25, 100, 90];
      const headers = ['Name', 'Email', 'Phone', 'Institution', 'Course', 'Yr', 'Hostel', 'Owner Contact'];
      let x = 30, y = doc.y;

      headers.forEach((h, i) => {
        doc.rect(x, y, cols[i], 18).fill('#6c3ec0');
        doc.fillColor('#fff').fontSize(8).text(h, x + 3, y + 5, { width: cols[i] - 6 });
        x += cols[i];
      });
      y += 18;

      students.forEach((s, idx) => {
        if (y > 540) { doc.addPage({ size: 'A4', layout: 'landscape' }); y = 30; }
        x = 30;
        const row = [
          s.name, s.email, s.phone, s.institution || '', s.course || '',
          s.year_of_study || '', s.current_hostel || 'N/A', s.owner_contact || 'N/A',
        ];
        row.forEach((val, i) => {
          doc.rect(x, y, cols[i], 16).fill(idx % 2 === 0 ? '#f8f5ff' : '#fff').stroke('#ddd');
          doc.fillColor('#333').fontSize(7).text(String(val), x + 3, y + 4, { width: cols[i] - 6, ellipsis: true });
          x += cols[i];
        });
        y += 16;
      });
      doc.end();
      return;
    }

    // Default: CSV
    const fields = [
      { label: 'Name',           value: 'name' },
      { label: 'Email',          value: 'email' },
      { label: 'Phone',          value: 'phone' },
      { label: 'Institution',    value: 'institution' },
      { label: 'Course',         value: 'course' },
      { label: 'Year',           value: 'year_of_study' },
      { label: 'Current Hostel', value: 'current_hostel' },
      { label: 'Hostel Address', value: 'hostel_address' },
      { label: 'Hostel Owner',   value: 'hostel_owner' },
      { label: 'Owner Contact',  value: 'owner_contact' },
    ];
    const csv = new Parser({ fields }).parse(students);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="students_report_${Date.now()}.csv"`);
    return res.send(csv);

  } catch (err) {
    console.error('University student report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
