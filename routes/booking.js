const express = require('express');
const db      = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { stkPush, b2cRefund } = require('../config/mpesa');
const { sendBookingConfirmation, sendRefundNotification } = require('../config/email');

const router = express.Router();

// ── POST /api/booking/book ─────────────────────────────────────────────────
router.post('/book', authenticate, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can make bookings' });
  }

  const conn = await db.getConnection();
  try {
    const { hostel_id, mpesa_phone, check_in_date, notes } = req.body;

    if (!hostel_id || !mpesa_phone) {
      return res.status(400).json({ error: 'hostel_id and mpesa_phone are required' });
    }

    // Fetch hostel
    const [hostels] = await conn.query(
      "SELECT * FROM hostels WHERE id = ? AND status = 'approved'",
      [hostel_id]
    );
    if (!hostels.length) {
      return res.status(404).json({ error: 'Hostel not found or not available' });
    }
    const hostel = hostels[0];

    if (hostel.available_rooms < 1) {
      return res.status(400).json({ error: 'No rooms available in this hostel' });
    }

    // Check for duplicate active booking
    const [dupBooking] = await conn.query(
      "SELECT id FROM bookings WHERE hostel_id = ? AND student_id = ? AND status IN ('pending','confirmed')",
      [hostel_id, req.user.id]
    );
    if (dupBooking.length) {
      return res.status(409).json({ error: 'You already have an active booking for this hostel' });
    }

    await conn.beginTransaction();

    // Create booking
    const [result] = await conn.query(
      `INSERT INTO bookings (hostel_id, student_id, status, deposit_amount, mpesa_phone, check_in_date, notes)
       VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
      [hostel_id, req.user.id, hostel.deposit_amount, mpesa_phone, check_in_date || null, notes || null]
    );
    const bookingId = result.insertId;

    // Create pending payment record
    await conn.query(
      `INSERT INTO payments (booking_id, amount, mpesa_phone, status, payment_type)
       VALUES (?, ?, ?, 'pending', 'deposit')`,
      [bookingId, hostel.deposit_amount, mpesa_phone]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Booking created. Please complete M-Pesa payment to confirm.',
      bookingId,
      depositAmount: hostel.deposit_amount,
      hostelName: hostel.name,
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    conn.release();
  }
});

// ── GET /api/booking/my ────────────────────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name, h.address AS hostel_address,
              h.room_type, h.monthly_price,
              (SELECT image_path FROM hostel_images WHERE hostel_id = h.id AND is_primary = 1 LIMIT 1) AS hostel_image,
              u.name AS owner_name, u.phone AS owner_phone,
              p.status AS payment_status, p.mpesa_receipt,
              c.commission_amount, c.owner_amount
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users u ON u.id = h.owner_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.payment_type = 'deposit'
       LEFT JOIN commissions c ON c.booking_id = b.id
       WHERE b.student_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (err) {
    console.error('My bookings error:', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ── GET /api/booking/owner ─────────────────────────────────────────────────
router.get('/owner', authenticate, async (req, res) => {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only owners can view bookings' });
  }
  try {
    const ownerFilter = req.user.role === 'admin' ? '' : 'AND h.owner_id = ?';
    const params = req.user.role === 'admin' ? [] : [req.user.id];

    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name, h.deposit_amount,
              s.name AS student_name, s.phone AS student_phone,
              s.email AS student_email, s.institution, s.course, s.year_of_study,
              p.status AS payment_status, p.mpesa_receipt, p.amount AS paid_amount,
              c.commission_amount, c.owner_amount
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users s ON s.id = b.student_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.payment_type = 'deposit'
       LEFT JOIN commissions c ON c.booking_id = b.id
       WHERE 1=1 ${ownerFilter}
       ORDER BY b.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error('Owner bookings error:', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ── POST /api/booking/:id/cancel ─────────────────────────────────────────
router.post('/:id/cancel', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name, h.deposit_amount,
              u.name AS student_name, u.email AS student_email
       FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       JOIN users u ON u.id = b.student_id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // Auth check: student can cancel their own; admin can cancel any
    if (booking.student_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: `Booking cannot be cancelled (status: ${booking.status})` });
    }

    // 3-day cancellation window check (students only; admin can override)
    const now            = new Date();
    const cancelDeadline = new Date(booking.cancel_deadline);
    const withinWindow   = now <= cancelDeadline;

    if (!withinWindow && req.user.role !== 'admin') {
      return res.status(400).json({
        error: `Cancellation window has passed (deadline was ${cancelDeadline.toDateString()}). Contact support.`,
      });
    }

    // Check if payment was made
    const [payments] = await conn.query(
      "SELECT * FROM payments WHERE booking_id = ? AND status = 'completed' AND payment_type = 'deposit'",
      [booking.id]
    );
    const hasPaidDeposit = payments.length > 0;

    await conn.beginTransaction();

    await conn.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
      [booking.id]
    );

    // Restore room availability
    await conn.query(
      'UPDATE hostels SET available_rooms = available_rooms + 1 WHERE id = ? AND available_rooms < total_rooms',
      [booking.hostel_id]
    );

    let refundInitiated = false;
    if (hasPaidDeposit && withinWindow) {
      // Calculate refund (subtract commission if already processed)
      const [commission] = await conn.query(
        'SELECT commission_amount FROM commissions WHERE booking_id = ?',
        [booking.id]
      );
      const refundAmount = commission.length
        ? booking.deposit_amount - commission[0].commission_amount
        : booking.deposit_amount;

      // Insert refund payment record
      await conn.query(
        `INSERT INTO payments (booking_id, amount, mpesa_phone, status, payment_type)
         VALUES (?, ?, ?, 'pending', 'refund')`,
        [booking.id, refundAmount, booking.mpesa_phone]
      );

      // Initiate M-Pesa B2C refund (non-blocking, continue even if it fails)
      b2cRefund({
        phone:   booking.mpesa_phone,
        amount:  refundAmount,
        remarks: `Refund for booking #${booking.id} - ${booking.hostel_name}`,
      })
        .then(async (result) => {
          if (result && result.ResponseCode === '0') {
            await db.query(
              "UPDATE payments SET status = 'refunded', mpesa_receipt = ? WHERE booking_id = ? AND payment_type = 'refund'",
              [result.ConversationID || 'PROCESSING', booking.id]
            );
          }
        })
        .catch(err => console.error('B2C refund error:', err.message));

      refundInitiated = true;

      // Send refund email
      sendRefundNotification(
        booking.student_email, booking.student_name,
        booking.hostel_name, refundAmount
      ).catch(() => {});
    }

    // Notify owner
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT h.owner_id, 'booking_cancelled', 'Booking Cancelled',
              CONCAT(?, ' has cancelled their booking for ', ?, '.')
       FROM hostels h WHERE h.id = ?`,
      [booking.student_name, booking.hostel_name, booking.hostel_id]
    );

    await conn.commit();

    return res.json({
      message: 'Booking cancelled successfully.',
      refundInitiated,
      refundNote: refundInitiated
        ? 'Refund has been initiated to your M-Pesa. Expect it within 24 hours.'
        : hasPaidDeposit
          ? 'Cancellation window passed — no refund issued.'
          : 'No payment was made — no refund needed.',
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Cancel booking error:', err);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    conn.release();
  }
});

// ── POST /api/booking/:id/release ─────────────────────────────────────────
// Student releases hostel (changes mind after confirmation, outside cancel window)
router.post('/:id/release', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name FROM bookings b
       JOIN hostels h ON h.id = b.hostel_id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    if (booking.student_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed bookings can be released' });
    }

    await conn.beginTransaction();

    await conn.query(
      "UPDATE bookings SET status = 'released' WHERE id = ?",
      [booking.id]
    );

    // Immediately update room availability
    await conn.query(
      'UPDATE hostels SET available_rooms = available_rooms + 1 WHERE id = ? AND available_rooms < total_rooms',
      [booking.hostel_id]
    );

    // Notify owner
    await conn.query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT h.owner_id, 'booking_released', 'Room Released',
              CONCAT(u.name, ' has released their room at ', ?, '. It is now available again.')
       FROM hostels h JOIN users u ON u.id = ?
       WHERE h.id = ?`,
      [booking.hostel_name, req.user.id, booking.hostel_id]
    );

    await conn.commit();

    // Emit real-time availability update via socket (server.js handles the io instance)
    if (req.app.get('io')) {
      req.app.get('io').emit('hostel_availability_updated', {
        hostelId: booking.hostel_id,
      });
    }

    return res.json({
      message: 'Hostel released successfully. The room is now available for other students.',
      note: 'Note: Releasing a confirmed booking forfeits your deposit as the cancellation window has passed.',
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Release booking error:', err);
    return res.status(500).json({ error: 'Failed to release booking' });
  } finally {
    conn.release();
  }
});

// ── GET /api/booking/:id ───────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, h.name AS hostel_name, h.address, h.monthly_price,
              h.deposit_amount, h.room_type,
              s.name AS student_name, s.phone AS student_phone, s.email AS student_email,
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
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // Access control
    const isStudent = booking.student_id === req.user.id;
    const isAdmin   = req.user.role === 'admin';
    // Owner check requires joining
    const [isOwnerRow] = await db.query(
      'SELECT id FROM hostels WHERE id = ? AND owner_id = ?',
      [booking.hostel_id, req.user.id]
    );
    const isOwner = isOwnerRow.length > 0;

    if (!isStudent && !isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }

    return res.json(booking);
  } catch (err) {
    console.error('Get booking error:', err);
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

module.exports = router;
