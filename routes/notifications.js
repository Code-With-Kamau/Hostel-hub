const router = require('express').Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [data] = await db.execute('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30', [req.user.id]);
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
