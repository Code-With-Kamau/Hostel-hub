// booking.js
const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/book', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { hostel_id, move_in_date, duration_months = 1, notes, wants_roommate = 0, roommate_gender = 'any' } = req.body;
    const [hostel] = await db.execute('SELECT * FROM hostels WHERE id=? AND status="available" AND is_approved=1', [hostel_id]);
    if (!hostel.length) return res.json({ success: false, message: 'Hostel not available for booking' });
    const h = hostel[0];
    const [existing] = await db.execute('SELECT id FROM bookings WHERE hostel_id=? AND student_id=? AND status IN ("pending","confirmed")', [hostel_id, req.user.id]);
    if (existing.length) return res.json({ success: false, message: 'You already have an active booking for this hostel' });
    const [result] = await db.execute(`
      INSERT INTO bookings (hostel_id,student_id,move_in_date,duration_months,deposit_amount,monthly_rent,notes,wants_roommate,roommate_gender)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [hostel_id, req.user.id, move_in_date || null, duration_months, h.deposit_amount, h.price_per_month, notes || null, wants_roommate ? 1 : 0, roommate_gender]);
    await db.execute(`INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)`,
      [h.owner_id, 'New Booking Request', `A student wants to book "${h.title}"`, 'booking']);
    const [booking] = await db.execute('SELECT * FROM bookings WHERE id=?', [result.insertId]);
    res.json({ success: true, message: 'Booking created! Proceed to pay deposit.', booking: booking[0] });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT b.*, h.title as hostel_title, h.location, h.room_type,
        (SELECT image_url FROM hostel_images WHERE hostel_id=h.id AND is_primary=1 LIMIT 1) as hostel_image,
        u.name as owner_name, u.phone as owner_phone,
        p.mpesa_receipt_number, p.status as payment_status, p.amount as paid_amount
      FROM bookings b JOIN hostels h ON b.hostel_id=h.id JOIN users u ON h.owner_id=u.id
      LEFT JOIN payments p ON p.booking_id=b.id AND p.status="completed"
      WHERE b.student_id=? ORDER BY b.created_at DESC`, [req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/owner', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT b.*, h.title as hostel_title, h.location,
        u.name as student_name, u.phone as student_phone, u.email as student_email,
        u.institution, u.course, u.year_of_study,
        p.mpesa_receipt_number, p.status as payment_status, p.amount as paid_amount
      FROM bookings b JOIN hostels h ON b.hostel_id=h.id JOIN users u ON b.student_id=u.id
      LEFT JOIN payments p ON p.booking_id=b.id AND p.status="completed"
      WHERE h.owner_id=? ORDER BY b.created_at DESC`, [req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM bookings WHERE id=?', [req.params.id]);
    if (!rows.length) return res.json({ success: false, message: 'Not found' });
    if (rows[0].student_id !== req.user.id && req.user.role !== 'admin')
      return res.json({ success: false, message: 'Not authorized' });
    await db.execute('UPDATE bookings SET status="cancelled" WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
