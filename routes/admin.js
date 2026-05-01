const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const MW = [authenticateToken, requireRole('admin')];

router.get('/stats', ...MW, async (req, res) => {
  try {
    const [[users]] = await db.execute(`SELECT COUNT(*) as total, SUM(role='student') as students, SUM(role='owner') as owners FROM users WHERE is_active=1`);
    const [[hostels]] = await db.execute(`SELECT COUNT(*) as total, SUM(is_approved=0) as pending, SUM(status='available') as available FROM hostels`);
    const [[bookings]] = await db.execute(`SELECT COUNT(*) as total, SUM(status='confirmed') as confirmed, SUM(status='pending') as pending FROM bookings`);
    const [[revenue]] = await db.execute(`SELECT SUM(amount) as total FROM payments WHERE status='completed'`);
    const [recent_bookings] = await db.execute(`SELECT b.*,h.title as hostel_title,u.name as student_name FROM bookings b JOIN hostels h ON b.hostel_id=h.id JOIN users u ON b.student_id=u.id ORDER BY b.created_at DESC LIMIT 5`);
    const [recent_users] = await db.execute(`SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 5`);
    res.json({ success: true, stats: { users, hostels, bookings, revenue }, recent_bookings, recent_users });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/hostels', ...MW, async (req, res) => {
  try {
    const { is_approved, status } = req.query;
    let where = []; const vals = [];
    if (is_approved !== undefined) { where.push('h.is_approved=?'); vals.push(is_approved); }
    if (status) { where.push('h.status=?'); vals.push(status); }
    const [data] = await db.execute(`
      SELECT h.*, u.name as owner_name, u.email as owner_email,
        (SELECT image_url FROM hostel_images WHERE hostel_id=h.id AND is_primary=1 LIMIT 1) as primary_image
      FROM hostels h JOIN users u ON h.owner_id=u.id
      ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY h.is_approved ASC, h.created_at DESC`, vals);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/hostels/:id/approve', ...MW, async (req, res) => {
  try {
    const { approved, reason } = req.body;
    await db.execute('UPDATE hostels SET is_approved=?, status=? WHERE id=?',
      [approved ? 1 : 0, approved ? 'available' : 'unlisted', req.params.id]);
    const [rows] = await db.execute('SELECT h.*,u.id as owner_id FROM hostels h JOIN users u ON h.owner_id=u.id WHERE h.id=?', [req.params.id]);
    if (rows.length) {
      const msg = approved ? `Your hostel "${rows[0].title}" has been approved and is now live!`
        : `Your hostel "${rows[0].title}" was not approved. ${reason || ''}`;
      await db.execute(`INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)`,
        [rows[0].owner_id, approved ? '✅ Hostel Approved!' : '❌ Hostel Not Approved', msg, 'hostel']);
    }
    res.json({ success: true, message: approved ? 'Hostel approved and live!' : 'Hostel rejected' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/users', ...MW, async (req, res) => {
  try {
    const { role } = req.query;
    const [data] = await db.execute(`SELECT id,name,email,phone,role,institution,course,is_active,created_at FROM users ${role?'WHERE role=?':''} ORDER BY created_at DESC`, role ? [role] : []);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/users/:id', ...MW, async (req, res) => {
  try {
    const { is_active, role } = req.body;
    const sets = []; const vals = [];
    if (is_active !== undefined) { sets.push('is_active=?'); vals.push(is_active ? 1 : 0); }
    if (role) { sets.push('role=?'); vals.push(role); }
    vals.push(req.params.id);
    await db.execute(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals);
    res.json({ success: true, message: 'User updated' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/bookings', ...MW, async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT b.*, h.title as hostel_title, h.location,
        s.name as student_name, s.phone as student_phone, o.name as owner_name,
        p.mpesa_receipt_number, p.amount as paid_amount
      FROM bookings b JOIN hostels h ON b.hostel_id=h.id
      JOIN users s ON b.student_id=s.id JOIN users o ON h.owner_id=o.id
      LEFT JOIN payments p ON p.booking_id=b.id AND p.status='completed'
      ORDER BY b.created_at DESC`);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
