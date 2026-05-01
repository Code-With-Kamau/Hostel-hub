// routes/chat.js
const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT m.conversation_id,
        MAX(m.created_at) as last_message_time,
        (SELECT message FROM messages WHERE conversation_id=m.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
        IF(m.sender_id=?, m.receiver_id, m.sender_id) as other_user_id,
        (SELECT name FROM users WHERE id=IF(m.sender_id=?, m.receiver_id, m.sender_id)) as other_user_name,
        (SELECT profile_photo FROM users WHERE id=IF(m.sender_id=?, m.receiver_id, m.sender_id)) as other_user_photo,
        (SELECT COUNT(*) FROM messages WHERE conversation_id=m.conversation_id AND receiver_id=? AND is_read=0) as unread_count,
        m.hostel_id,
        (SELECT title FROM hostels WHERE id=m.hostel_id) as hostel_title
      FROM messages m WHERE m.sender_id=? OR m.receiver_id=?
      GROUP BY m.conversation_id ORDER BY last_message_time DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/messages/:convId', authenticateToken, async (req, res) => {
  try {
    const [data] = await db.execute(`
      SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
      FROM messages m JOIN users u ON m.sender_id=u.id
      WHERE m.conversation_id=? ORDER BY m.created_at ASC LIMIT 100`, [req.params.convId]);
    await db.execute('UPDATE messages SET is_read=1 WHERE conversation_id=? AND receiver_id=?', [req.params.convId, req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM messages WHERE receiver_id=? AND is_read=0', [req.user.id]);
    res.json({ success: true, count: rows[0].count });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
