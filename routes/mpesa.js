const express = require('express');
const db      = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { stkPush, normalizePhone } = require('../config/mpesa');
const { sendBookingConfirmation } = require('../config/email');

const router = express.Router();

// ── POST /api/mpesa/pay ────────────────────────────────────────────────────
router.post('/pay', authenticate, async (req, res) => {
  const { booking_id, phone } = req.body;

  if (!booking_id || !phone) {
    return res.status(400).json({ error: 'booking_id and phone are required' });
  }

  try {
    // Validate the booking belongs to this user
    const [bookings] = await db.query(
      "SELECT b.*, h.name AS hostel_name, h.deposit_amount FROM bookings b JOIN hostels h ON h.id = b.hostel_id WHERE b.id = ? AND b.student_id = ? AND b.status = 'pending'",
      [booking_id, req.user.id]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: 'Pending booking not found' });
    }
    const booking = bookings[0];

    // Check for an already-pending or completed payment
    const [existingPayments] = await db.query(
      "SELECT id, status FROM payments WHERE booking_id = ? AND payment_type = 'deposit' AND status IN ('pending','completed')",
      [booking_id]
    );
    if (existingPayments.length && existingPayments[0].status === 'completed') {
      return res.status(400).json({ error: 'Payment already completed for this booking' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      return res.status(400).json({ error: 'Invalid Kenyan phone number. Use format: 0712345678 or +254712345678' });
    }

    // Initiate STK push
    const stkResult = await stkPush({
      phone:      normalizedPhone,
      amount:     booking.deposit_amount,
      accountRef: `HH${booking_id}`,
      description: `Deposit-${booking.hostel_name.slice(0, 8)}`,
    });

    if (stkResult.ResponseCode !== '0') {
      return res.status(400).json({ error: stkResult.ResponseDescription || 'STK push failed' });
    }

    // Store the checkout request ID
    await db.query(
      `UPDATE payments SET checkout_req_id = ?, mpesa_phone = ?, status = 'pending'
       WHERE booking_id = ? AND payment_type = 'deposit'`,
      [stkResult.CheckoutRequestID, normalizedPhone, booking_id]
    );

    return res.json({
      message: 'M-Pesa prompt sent to your phone. Enter your PIN to complete payment.',
      checkoutRequestId: stkResult.CheckoutRequestID,
    });

  } catch (err) {
    console.error('M-Pesa pay error:', err);
    const msg = err.response?.data?.errorMessage || err.message || 'Payment initiation failed';
    return res.status(500).json({ error: msg });
  }
});

// ── POST /api/mpesa/callback ───────────────────────────────────────────────
// Called by Safaricom Daraja after payment
router.post('/callback', async (req, res) => {
  // Always respond 200 immediately to Safaricom
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback  = req.body?.Body?.stkCallback;
    if (!callback)  return;

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode        = callback.ResultCode;

    const [payments] = await db.query(
      "SELECT p.*, b.hostel_id, b.student_id, b.id AS booking_id FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.checkout_req_id = ? AND p.payment_type = 'deposit'",
      [checkoutRequestId]
    );

    if (!payments.length) {
      console.warn('M-Pesa callback: no matching payment for', checkoutRequestId);
      return;
    }

    const payment = payments[0];

    if (resultCode !== 0) {
      // Payment failed or cancelled
      await db.query(
        "UPDATE payments SET status = 'failed' WHERE id = ?",
        [payment.id]
      );
      // Notify student
      await db.query(
        "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'payment_failed', 'Payment Failed', 'Your M-Pesa payment was not completed. Please try again.')",
        [payment.student_id]
      );
      return;
    }

    // Payment successful
    const items       = callback.CallbackMetadata?.Item || [];
    const getItem     = (name) => items.find(i => i.Name === name)?.Value || null;
    const mpesaReceipt = getItem('MpesaReceiptNumber');
    const amount       = getItem('Amount') || payment.amount;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Update payment
      await conn.query(
        "UPDATE payments SET status = 'completed', mpesa_receipt = ?, amount = ? WHERE id = ?",
        [mpesaReceipt, amount, payment.id]
      );

      // Confirm booking & decrement room
      await conn.query(
        "UPDATE bookings SET status = 'confirmed', mpesa_phone = ? WHERE id = ?",
        [payment.mpesa_phone, payment.booking_id]
      );
      await conn.query(
        'UPDATE hostels SET available_rooms = GREATEST(available_rooms - 1, 0) WHERE id = ?',
        [payment.hostel_id]
      );

      // ── 10% Admin Commission ────────────────────────────────────────────
      const totalAmount      = Number(amount);
      const commissionAmount = parseFloat((totalAmount * 0.10).toFixed(2));
      const ownerAmount      = parseFloat((totalAmount * 0.90).toFixed(2));

      await conn.query(
        `INSERT INTO commissions (booking_id, payment_id, total_amount, commission_amount, owner_amount)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount),
           commission_amount = VALUES(commission_amount), owner_amount = VALUES(owner_amount)`,
        [payment.booking_id, payment.id, totalAmount, commissionAmount, ownerAmount]
      );

      // Notify student
      await conn.query(
        "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'booking_confirmed', 'Booking Confirmed! 🎉', ?)",
        [payment.student_id, `Your payment of KES ${Number(amount).toLocaleString()} was received (Receipt: ${mpesaReceipt}). Your room is confirmed!`]
      );

      // Notify owner
      const [hostelOwner] = await conn.query(
        'SELECT h.owner_id, h.name AS hostel_name FROM hostels h WHERE h.id = ?',
        [payment.hostel_id]
      );
      if (hostelOwner.length) {
        await conn.query(
          "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'payment_received', 'Deposit Received 💰', ?)",
          [hostelOwner[0].owner_id, `Deposit of KES ${Number(ownerAmount).toLocaleString()} received for ${hostelOwner[0].hostel_name} (your share after 10% platform fee). Receipt: ${mpesaReceipt}`]
        );
      }

      // Notify admin
      await conn.query(
        "INSERT INTO notifications (SELECT id, 'commission_earned', 'Commission Earned', ? FROM users WHERE role = 'admin')",
        [`KES ${commissionAmount.toLocaleString()} commission earned from booking #${payment.booking_id}. M-Pesa receipt: ${mpesaReceipt}`]
      );

      await conn.commit();

      // Send confirmation email (non-blocking)
      const [bookingInfo] = await db.query(
        'SELECT u.email, u.name, h.name AS hostel_name, b.deposit_amount, b.cancel_deadline FROM bookings b JOIN users u ON u.id = b.student_id JOIN hostels h ON h.id = b.hostel_id WHERE b.id = ?',
        [payment.booking_id]
      );
      if (bookingInfo.length) {
        const bi = bookingInfo[0];
        sendBookingConfirmation(bi.email, bi.name, bi.hostel_name, bi.deposit_amount, bi.cancel_deadline)
          .catch(err => console.error('Email error:', err.message));
      }

      // Real-time update
      if (global.io) {
        global.io.emit('hostel_availability_updated', { hostelId: payment.hostel_id });
        global.io.to(`user_${payment.student_id}`).emit('booking_confirmed', { bookingId: payment.booking_id });
      }

    } catch (err) {
      await conn.rollback().catch(() => {});
      console.error('Callback processing error:', err);
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('M-Pesa callback error:', err);
  }
});

// ── POST /api/mpesa/simulate ───────────────────────────────────────────────
// Dev-only: simulate a successful payment without real Daraja
router.post('/simulate', authenticate, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Simulation not allowed in production' });
  }

  const { booking_id } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

  const conn = await db.getConnection();
  try {
    const [bookings] = await conn.query(
      "SELECT b.*, h.name AS hostel_name, h.owner_id FROM bookings b JOIN hostels h ON h.id = b.hostel_id WHERE b.id = ? AND b.student_id = ? AND b.status = 'pending'",
      [booking_id, req.user.id]
    );

    if (!bookings.length) {
      return res.status(404).json({ error: 'Pending booking not found' });
    }
    const booking = bookings[0];

    const fakeReceipt      = 'SIM' + Date.now();
    const totalAmount      = Number(booking.deposit_amount);
    const commissionAmount = parseFloat((totalAmount * 0.10).toFixed(2));
    const ownerAmount      = parseFloat((totalAmount * 0.90).toFixed(2));

    await conn.beginTransaction();

    // Update or create payment
    const [existPay] = await conn.query(
      "SELECT id FROM payments WHERE booking_id = ? AND payment_type = 'deposit'",
      [booking_id]
    );
    if (existPay.length) {
      await conn.query(
        "UPDATE payments SET status = 'completed', mpesa_receipt = ? WHERE id = ?",
        [fakeReceipt, existPay[0].id]
      );
    } else {
      const [payResult] = await conn.query(
        "INSERT INTO payments (booking_id, amount, mpesa_phone, mpesa_receipt, status, payment_type) VALUES (?, ?, ?, ?, 'completed', 'deposit')",
        [booking_id, totalAmount, booking.mpesa_phone, fakeReceipt]
      );
      await conn.query(
        `INSERT INTO commissions (booking_id, payment_id, total_amount, commission_amount, owner_amount) VALUES (?, ?, ?, ?, ?)`,
        [booking_id, payResult.insertId, totalAmount, commissionAmount, ownerAmount]
      );
    }

    await conn.query(
      "UPDATE bookings SET status = 'confirmed' WHERE id = ?",
      [booking_id]
    );
    await conn.query(
      'UPDATE hostels SET available_rooms = GREATEST(available_rooms - 1, 0) WHERE id = ?',
      [booking.hostel_id]
    );

    // Commissions
    const [existPay2] = await conn.query(
      "SELECT id FROM payments WHERE booking_id = ? AND payment_type = 'deposit'",
      [booking_id]
    );
    await conn.query(
      `INSERT INTO commissions (booking_id, payment_id, total_amount, commission_amount, owner_amount)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_amount=VALUES(total_amount), commission_amount=VALUES(commission_amount), owner_amount=VALUES(owner_amount)`,
      [booking_id, existPay2[0].id, totalAmount, commissionAmount, ownerAmount]
    );

    await conn.query(
      "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'booking_confirmed', 'Booking Confirmed! 🎉', ?)",
      [req.user.id, `Simulated payment accepted. Receipt: ${fakeReceipt}. Your room is confirmed!`]
    );

    await conn.commit();

    if (global.io) {
      global.io.emit('hostel_availability_updated', { hostelId: booking.hostel_id });
    }

    return res.json({
      message: '✅ Simulated payment successful! Booking confirmed.',
      receipt: fakeReceipt,
      commission: commissionAmount,
      ownerReceives: ownerAmount,
    });

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Simulate payment error:', err);
    return res.status(500).json({ error: 'Simulation failed' });
  } finally {
    conn.release();
  }
});

// ── POST /api/mpesa/b2c/result ─────────────────────────────────────────────
router.post('/b2c/result', async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  try {
    const result = req.body?.Result;
    if (!result) return;

    if (result.ResultCode === 0) {
      const params      = result.ResultParameters?.ResultParameter || [];
      const getParam    = (key) => params.find(p => p.Key === key)?.Value || null;
      const convId      = result.ConversationID;

      await db.query(
        "UPDATE payments SET status = 'refunded', mpesa_receipt = ? WHERE mpesa_receipt = ? AND payment_type = 'refund'",
        [getParam('TransactionReceipt') || convId, convId]
      );
    }
  } catch (err) {
    console.error('B2C result error:', err);
  }
});

// ── POST /api/mpesa/b2c/timeout ────────────────────────────────────────────
router.post('/b2c/timeout', async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  console.warn('B2C timeout received:', req.body);
});

module.exports = router;
