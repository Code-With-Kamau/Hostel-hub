const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const mpesa = require('../config/mpesa');

router.get('/status', (req, res) => {
  try {
    mpesa.assertMpesaConfigured();
    res.json({
      success: true,
      configured: true,
      env: process.env.MPESA_ENV || 'sandbox',
      shortcode: process.env.MPESA_SHORTCODE ? String(process.env.MPESA_SHORTCODE) : null,
      callbackUrl: process.env.MPESA_CALLBACK_URL || null,
    });
  } catch (e) {
    res.json({
      success: true,
      configured: false,
      message: e.message,
      env: process.env.MPESA_ENV || 'sandbox',
      shortcode: process.env.MPESA_SHORTCODE ? String(process.env.MPESA_SHORTCODE) : null,
      callbackUrl: process.env.MPESA_CALLBACK_URL || null,
    });
  }
});

router.post('/pay', authenticateToken, async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    const [rows] = await db.execute('SELECT * FROM bookings WHERE id=? AND student_id=?', [booking_id, req.user.id]);
    if (!rows.length) return res.json({ success: false, message: 'Booking not found' });
    const booking = rows[0];
    try {
      const data = await mpesa.stkPush(phone, booking.deposit_amount, booking_id, `HostelHub Deposit Hostel#${booking.hostel_id}`);
      await db.execute('INSERT INTO payments (booking_id,user_id,amount,phone,mpesa_checkout_id,status) VALUES (?,?,?,?,?,"pending")',
        [booking_id, req.user.id, booking.deposit_amount, phone, data.CheckoutRequestID]);
      res.json({ success: true, message: 'STK Push sent! Check your phone.', checkoutId: data.CheckoutRequestID });
    } catch (mpesaErr) {
      res.json({ success: false, message: mpesaErr.message });
    }
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// M-Pesa callback
router.post('/callback', async (req, res) => {
  try {
    const { Body: { stkCallback } } = req.body;
    const checkoutId = stkCallback.CheckoutRequestID;
    if (stkCallback.ResultCode === 0) {
      const items = stkCallback.CallbackMetadata.Item;
      const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount = items.find(i => i.Name === 'Amount')?.Value;
      await db.execute('UPDATE payments SET status="completed", mpesa_receipt_number=? WHERE mpesa_checkout_id=?', [receipt, checkoutId]);
      const [payments] = await db.execute('SELECT * FROM payments WHERE mpesa_checkout_id=?', [checkoutId]);
      if (payments.length) {
        const p = payments[0];
        await db.execute('UPDATE bookings SET status="confirmed", deposit_paid=1 WHERE id=?', [p.booking_id]);
        const [bookings] = await db.execute('SELECT b.*,h.owner_id,h.total_rooms FROM bookings b JOIN hostels h ON b.hostel_id=h.id WHERE b.id=?', [p.booking_id]);
        if (bookings.length) {
          const b = bookings[0];
          await db.execute('UPDATE hostels SET available_rooms=GREATEST(available_rooms-1,0) WHERE id=?', [b.hostel_id]);
          await db.execute(`INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?),(?,?,?,?)`,
            [p.user_id,'Payment Confirmed!',`Deposit of KES ${amount} received. Receipt: ${receipt}`,'payment',
             b.owner_id,'Deposit Received!',`Deposit of KES ${amount} received for your hostel. Receipt: ${receipt}`,'payment']);
        }
      }
    } else {
      await db.execute('UPDATE payments SET status="failed" WHERE mpesa_checkout_id=?', [checkoutId]);
    }
    // Daraja requires a fast 200 OK response for callbacks.
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (e) { res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); }
});

// Dev simulate
router.post('/simulate', authenticateToken, async (req, res) => {
  try {
    const { booking_id, phone = '0700000000' } = req.body;
    const [rows] = await db.execute('SELECT * FROM bookings WHERE id=? AND student_id=?', [booking_id, req.user.id]);
    if (!rows.length) return res.json({ success: false, message: 'Booking not found' });
    const booking = rows[0];
    const receipt = 'SIM' + Date.now();
    await db.execute('INSERT INTO payments (booking_id,user_id,amount,phone,mpesa_receipt_number,status) VALUES (?,?,?,?,?,"completed")',
      [booking_id, req.user.id, booking.deposit_amount, phone, receipt]);
    await db.execute('UPDATE bookings SET status="confirmed", deposit_paid=1 WHERE id=?', [booking_id]);
    await db.execute('UPDATE hostels SET available_rooms=GREATEST(available_rooms-1,0) WHERE id=?', [booking.hostel_id]);
    await db.execute(`INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)`,
      [req.user.id,'Booking Confirmed!',`Your hostel booking is confirmed. Receipt: ${receipt}`,'payment']);
    res.json({ success: true, message: 'Payment simulated successfully!', receipt });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
