const express    = require('express');
const { Parser } = require('json2csv');
const PDFDoc     = require('pdfkit');
const db         = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student')    AS total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'owner')      AS total_owners,
        (SELECT COUNT(*) FROM users WHERE role = 'university') AS total_universities,
        (SELECT COUNT(*) FROM users)                           AS total_users,
        (SELECT COUNT(*) FROM hostels)                         AS total_hostels,
        (SELECT COUNT(*) FROM hostels WHERE status = 'approved')  AS approved_hostels,
        (SELECT COUNT(*) FROM hostels WHERE status = 'pending')   AS pending_hostels,
        (SELECT COUNT(*) FROM bookings)                            AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'completed' AND payment_type='deposit') AS total_deposits,
        (SELECT COALESCE(SUM(commission_amount),0) FROM commissions)  AS total_commission,
        (SELECT COUNT(*) FROM users WHERE is_banned = 1)       AS banned_users
    `);

    const [recentBookings] = await db.query(
      `SELECT b.id, b.status, b.created_at, h.name AS hostel_name,
              s.name AS student_name, p.amount, p.mpesa_receipt
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users s ON s.id = b.student_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.payment_type = 'deposit'
       ORDER BY b.created_at DESC LIMIT 10`
    );

    const [pendingHostels] = await db.query(
      `SELECT h.id, h.name, h.address, h.room_type, h.monthly_price, h.created_at,
              u.name AS owner_name, u.phone AS owner_phone
       FROM hostels h JOIN users u ON u.id = h.owner_id
       WHERE h.status = 'pending' ORDER BY h.created_at ASC LIMIT 10`
    );

    return res.json({ stats, recentBookings, pendingHostels });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params     = [];

    if (role) { conditions.push('role = ?'); params.push(role); }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [users] = await db.query(
      `SELECT id, name, email, phone, role, institution, course, year_of_study,
              is_banned, email_verified, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params
    );

    return res.json({ users, total });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── PUT /api/admin/users/:id ───────────────────────────────────────────────
router.put('/users/:id', async (req, res) => {
  const { is_banned, role } = req.body;
  try {
    const [rows] = await db.query('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role === 'admin' && req.user.id !== rows[0].id) {
      return res.status(403).json({ error: 'Cannot modify another admin account' });
    }

    const updates = [];
    const values  = [];
    if (is_banned !== undefined) { updates.push('is_banned = ?'); values.push(is_banned ? 1 : 0); }
    if (role && ['student','owner','university','admin'].includes(role)) {
      updates.push('role = ?'); values.push(role);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    await db.query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'user_update', 'user', req.params.id, JSON.stringify(req.body)]
    );

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Admin update user error:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── GET /api/admin/hostels ─────────────────────────────────────────────────
router.get('/hostels', async (req, res) => {
  try {
    const { status, search } = req.query;
    const conditions = [];
    const params     = [];

    if (status) { conditions.push('h.status = ?'); params.push(status); }
    if (search) {
      conditions.push('(h.name LIKE ? OR h.address LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await db.query(
      `SELECT h.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email,
              (SELECT COUNT(*) FROM bookings WHERE hostel_id = h.id AND status = 'confirmed') AS active_bookings,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS primary_image
       FROM hostels h JOIN users u ON u.id = h.owner_id
       ${where} ORDER BY h.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error('Admin hostels error:', err);
    return res.status(500).json({ error: 'Failed to fetch hostels' });
  }
});

// ── PUT /api/admin/hostels/:id/approve ────────────────────────────────────
router.put('/hostels/:id/approve', async (req, res) => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }
  try {
    const [rows] = await db.query(
      'SELECT h.*, u.name AS owner_name FROM hostels h JOIN users u ON u.id = h.owner_id WHERE h.id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Hostel not found' });
    const hostel = rows[0];

    await db.query('UPDATE hostels SET status = ? WHERE id = ?', [status, req.params.id]);

    // Notify owner
    const msg = status === 'approved'
      ? `Your hostel "${hostel.name}" has been approved and is now live on HostelHub! 🎉`
      : `Your hostel "${hostel.name}" was not approved. Reason: ${reason || 'Does not meet our guidelines'}. You may re-submit after making changes.`;

    await db.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [hostel.owner_id, `hostel_${status}`, `Hostel ${status === 'approved' ? 'Approved' : 'Rejected'}`, msg]
    );

    await db.query(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, `hostel_${status}`, 'hostel', req.params.id, reason || null]
    );

    return res.json({ message: `Hostel ${status} successfully` });
  } catch (err) {
    console.error('Approve hostel error:', err);
    return res.status(500).json({ error: 'Failed to update hostel status' });
  }
});

// ── GET /api/admin/bookings ────────────────────────────────────────────────
router.get('/bookings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name, h.address AS hostel_address,
              s.name AS student_name, s.email AS student_email, s.phone AS student_phone,
              s.institution, s.course, s.year_of_study,
              o.name AS owner_name, o.phone AS owner_phone,
              p.status AS payment_status, p.mpesa_receipt, p.amount AS paid_amount,
              c.commission_amount, c.owner_amount
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users s ON s.id = b.student_id
       JOIN users o ON o.id = h.owner_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.payment_type = 'deposit'
       LEFT JOIN commissions c ON c.booking_id = b.id
       ORDER BY b.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Admin bookings error:', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ── GET /api/admin/commissions ─────────────────────────────────────────────
router.get('/commissions', async (req, res) => {
  try {
    const [[summary]] = await db.query(
      'SELECT COALESCE(SUM(commission_amount),0) AS total, COALESCE(SUM(owner_amount),0) AS owner_total, COUNT(*) AS count FROM commissions'
    );
    const [rows] = await db.query(
      `SELECT c.*, b.created_at AS booking_date, h.name AS hostel_name,
              s.name AS student_name, o.name AS owner_name, p.mpesa_receipt
       FROM commissions c
       JOIN bookings b ON b.id = c.booking_id
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users s ON s.id = b.student_id
       JOIN users o ON o.id = h.owner_id
       LEFT JOIN payments p ON p.id = c.payment_id
       ORDER BY c.created_at DESC`
    );
    return res.json({ summary, commissions: rows });
  } catch (err) {
    console.error('Commissions error:', err);
    return res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// ── GET /api/admin/report/students ────────────────────────────────────────
// Generate CSV/PDF report of all students
router.get('/report/students', async (req, res) => {
  try {
    const format = req.query.format || 'json';

    const [students] = await db.query(
      `SELECT
          u.id, u.name, u.email, u.phone, u.institution, u.course, u.year_of_study,
          u.created_at AS registered_at,
          (SELECT COUNT(*) FROM bookings WHERE student_id = u.id AND status = 'confirmed') AS active_bookings,
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
          ) AS owner_phone,
          (
            SELECT p.mpesa_receipt FROM bookings b JOIN payments p ON p.booking_id = b.id
            WHERE b.student_id = u.id AND b.status = 'confirmed' AND p.payment_type = 'deposit'
            ORDER BY b.created_at DESC LIMIT 1
          ) AS mpesa_receipt
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.name ASC`
    );

    if (format === 'csv') {
      const fields = [
        { label: 'ID',              value: 'id' },
        { label: 'Name',            value: 'name' },
        { label: 'Email',           value: 'email' },
        { label: 'Phone',           value: 'phone' },
        { label: 'Institution',     value: 'institution' },
        { label: 'Course',          value: 'course' },
        { label: 'Year of Study',   value: 'year_of_study' },
        { label: 'Current Hostel',  value: 'current_hostel' },
        { label: 'Hostel Address',  value: 'hostel_address' },
        { label: 'Hostel Owner',    value: 'hostel_owner' },
        { label: 'Owner Phone',     value: 'owner_phone' },
        { label: 'M-Pesa Receipt',  value: 'mpesa_receipt' },
        { label: 'Registered',      value: 'registered_at' },
      ];
      const parser = new Parser({ fields });
      const csv    = parser.parse(students);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="students_report_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      const doc = new PDFDoc({ margin: 30, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="students_report_${Date.now()}.pdf"`);
      doc.pipe(res);

      doc.fontSize(18).fillColor('#6c3ec0').text('HostelHub — Students Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-KE')}   Total Students: ${students.length}`, { align: 'center' });
      doc.moveDown(1);

      const colWidths = [30, 90, 130, 90, 110, 110, 30, 110, 90];
      const headers   = ['#', 'Name', 'Email', 'Phone', 'Institution', 'Course', 'Yr', 'Hostel', 'Owner'];
      let x = 30, y = doc.y;

      // Header row
      doc.fontSize(8).fillColor('#fff');
      headers.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], 18).fill('#6c3ec0');
        doc.fillColor('#fff').text(h, x + 3, y + 5, { width: colWidths[i] - 6 });
        x += colWidths[i];
      });
      y += 18;

      students.forEach((s, idx) => {
        if (y > 540) { doc.addPage({ size: 'A4', layout: 'landscape' }); y = 30; }
        x = 30;
        const rowColor = idx % 2 === 0 ? '#f8f5ff' : '#fff';
        const rowData  = [
          idx + 1,
          s.name || '',
          s.email || '',
          s.phone || '',
          s.institution || '',
          s.course || '',
          s.year_of_study || '',
          s.current_hostel || 'None',
          s.hostel_owner || 'N/A',
        ];
        rowData.forEach((val, i) => {
          doc.rect(x, y, colWidths[i], 16).fill(rowColor).stroke('#ddd');
          doc.fillColor('#333').fontSize(7).text(String(val), x + 3, y + 4, { width: colWidths[i] - 6, ellipsis: true });
          x += colWidths[i];
        });
        y += 16;
      });

      doc.end();
      return;
    }

    return res.json({ total: students.length, students });

  } catch (err) {
    console.error('Student report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── GET /api/admin/report/hostels ─────────────────────────────────────────
router.get('/report/hostels', async (req, res) => {
  try {
    const format = req.query.format || 'json';

    const [hostels] = await db.query(
      `SELECT h.id, h.name, h.address, h.county, h.room_type, h.gender_policy,
              h.monthly_price, h.deposit_amount, h.total_rooms, h.available_rooms,
              h.status, h.average_rating, h.total_reviews, h.created_at,
              u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
              (SELECT COUNT(*) FROM bookings WHERE hostel_id = h.id AND status = 'confirmed') AS confirmed_bookings,
              (SELECT COALESCE(SUM(p.amount),0) FROM bookings b JOIN payments p ON p.booking_id = b.id WHERE b.hostel_id = h.id AND p.status = 'completed') AS total_revenue
       FROM hostels h
       JOIN users u ON u.id = h.owner_id
       ORDER BY h.name ASC`
    );

    if (format === 'csv') {
      const fields = [
        { label: 'ID',               value: 'id' },
        { label: 'Hostel Name',      value: 'name' },
        { label: 'Address',          value: 'address' },
        { label: 'County',           value: 'county' },
        { label: 'Room Type',        value: 'room_type' },
        { label: 'Gender Policy',    value: 'gender_policy' },
        { label: 'Monthly Price',    value: 'monthly_price' },
        { label: 'Deposit',          value: 'deposit_amount' },
        { label: 'Total Rooms',      value: 'total_rooms' },
        { label: 'Available Rooms',  value: 'available_rooms' },
        { label: 'Status',           value: 'status' },
        { label: 'Rating',           value: 'average_rating' },
        { label: 'Confirmed Bookings', value: 'confirmed_bookings' },
        { label: 'Total Revenue (KES)', value: 'total_revenue' },
        { label: 'Owner Name',       value: 'owner_name' },
        { label: 'Owner Email',      value: 'owner_email' },
        { label: 'Owner Phone',      value: 'owner_phone' },
        { label: 'Listed On',        value: 'created_at' },
      ];
      const csv = new Parser({ fields }).parse(hostels);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="hostels_report_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      const doc = new PDFDoc({ margin: 30, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="hostels_report_${Date.now()}.pdf"`);
      doc.pipe(res);

      doc.fontSize(18).fillColor('#6c3ec0').text('HostelHub — Hostels Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-KE')}   Total Hostels: ${hostels.length}`, { align: 'center' });
      doc.moveDown(1);

      const colWidths = [25, 110, 100, 55, 55, 55, 55, 60, 90, 75];
      const headers   = ['#', 'Hostel', 'Address', 'Type', 'Price', 'Deposit', 'Rooms', 'Status', 'Owner', 'Phone'];
      let x = 30, y = doc.y;

      doc.fontSize(8).fillColor('#fff');
      headers.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], 18).fill('#6c3ec0');
        doc.fillColor('#fff').text(h, x + 2, y + 5, { width: colWidths[i] - 4 });
        x += colWidths[i];
      });
      y += 18;

      hostels.forEach((h, idx) => {
        if (y > 540) { doc.addPage({ size: 'A4', layout: 'landscape' }); y = 30; }
        x = 30;
        const rowColor = idx % 2 === 0 ? '#f8f5ff' : '#fff';
        const rowData  = [
          idx + 1, h.name, h.address, h.room_type,
          `KES ${Number(h.monthly_price).toLocaleString()}`,
          `KES ${Number(h.deposit_amount).toLocaleString()}`,
          `${h.available_rooms}/${h.total_rooms}`,
          h.status, h.owner_name, h.owner_phone,
        ];
        rowData.forEach((val, i) => {
          doc.rect(x, y, colWidths[i], 16).fill(rowColor).stroke('#ddd');
          doc.fillColor('#333').fontSize(7).text(String(val), x + 2, y + 4, { width: colWidths[i] - 4, ellipsis: true });
          x += colWidths[i];
        });
        y += 16;
      });

      doc.end();
      return;
    }

    return res.json({ total: hostels.length, hostels });

  } catch (err) {
    console.error('Hostel report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── GET /api/admin/logs ────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT al.*, u.name AS admin_name FROM admin_logs al
       JOIN users u ON u.id = al.admin_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
