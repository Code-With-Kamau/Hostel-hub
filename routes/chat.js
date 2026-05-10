const express = require('express');
const db      = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { normalizeKenyanPhone } = require('../utils/validators');

const router = express.Router();

// ── GET /api/chat/conversations ────────────────────────────────────────────
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.created_at,
              c.last_message, c.last_msg_at,
              h.id AS hostel_id, h.name AS hostel_name,
              -- The other user in the conversation
              CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS other_id,
              CASE WHEN c.user1_id = ? THEN u2.name ELSE u1.name END AS other_name,
              CASE WHEN c.user1_id = ? THEN u2.phone ELSE u1.phone END AS other_phone,
              CASE WHEN c.user1_id = ? THEN u2.role ELSE u1.role END AS other_role,
              CASE WHEN c.user1_id = ? THEN u2.profile_photo ELSE u1.profile_photo END AS other_photo,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.receiver_id = ? AND m.is_read = 0) AS unread_count
       FROM conversations c
       JOIN users u1 ON u1.id = c.user1_id
       JOIN users u2 ON u2.id = c.user2_id
       LEFT JOIN hostels h ON h.id = c.hostel_id
       WHERE c.user1_id = ? OR c.user2_id = ?
       ORDER BY COALESCE(c.last_msg_at, c.created_at) DESC`,
      Array(8).fill(req.user.id)
    );
    return res.json(rows);
  } catch (err) {
    console.error('Get conversations error:', err);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ── POST /api/chat/start ───────────────────────────────────────────────────
// Start or get existing conversation between two users
router.post('/start', authenticate, async (req, res) => {
  const { other_user_id, hostel_id } = req.body;

  if (!other_user_id) {
    return res.status(400).json({ error: 'other_user_id is required' });
  }
  if (parseInt(other_user_id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
  }

  try {
    const [otherUser] = await db.query(
      'SELECT id, name, phone, role FROM users WHERE id = ? AND is_banned = 0',
      [other_user_id]
    );
    if (!otherUser.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user1_id = Math.min(req.user.id, parseInt(other_user_id));
    const user2_id = Math.max(req.user.id, parseInt(other_user_id));

    // Find existing conversation
    const [existing] = await db.query(
      'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
      [user1_id, user2_id]
    );

    let conversationId;
    if (existing.length) {
      conversationId = existing[0].id;
    } else {
      const [result] = await db.query(
        'INSERT INTO conversations (user1_id, user2_id, hostel_id) VALUES (?, ?, ?)',
        [user1_id, user2_id, hostel_id || null]
      );
      conversationId = result.insertId;
    }

    // Generate WhatsApp link for the other user
    let whatsappLink = null;
    try {
      const normalized = normalizeKenyanPhone(otherUser[0].phone);
      const waPhone    = normalized.replace('+', '');
      whatsappLink     = `https://wa.me/${waPhone}`;
    } catch {}

    return res.json({
      conversationId,
      otherUser: otherUser[0],
      whatsappLink,
    });
  } catch (err) {
    console.error('Start conversation error:', err);
    return res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// ── GET /api/chat/messages/:conversationId ────────────────────────────────
router.get('/messages/:conversationId', authenticate, async (req, res) => {
  try {
    // Verify user is in this conversation
    const [conv] = await db.query(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [req.params.conversationId, req.user.id, req.user.id]
    );
    if (!conv.length) {
      return res.status(403).json({ error: 'Not your conversation' });
    }

    const page   = Math.max(1, parseInt(req.query.page || '1'));
    const limit  = Math.min(100, parseInt(req.query.limit || '50'));
    const offset = (page - 1) * limit;

    const [messages] = await db.query(
      `SELECT m.*, u.name AS sender_name, u.profile_photo AS sender_photo
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.conversationId, limit, offset]
    );

    // Mark messages as read
    await db.query(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0',
      [req.params.conversationId, req.user.id]
    );

    return res.json(messages.reverse()); // Return oldest first

  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── POST /api/chat/messages ────────────────────────────────────────────────
router.post('/messages', authenticate, async (req, res) => {
  const { conversation_id, content } = req.body;

  if (!conversation_id || !content?.trim()) {
    return res.status(400).json({ error: 'conversation_id and content are required' });
  }
  if (content.trim().length > 5000) {
    return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
  }

  const conn = await db.getConnection();
  try {
    const [conv] = await conn.query(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversation_id, req.user.id, req.user.id]
    );
    if (!conv.length) {
      return res.status(403).json({ error: 'Not your conversation' });
    }

    const conversation = conv[0];
    const receiver_id  = conversation.user1_id === req.user.id
      ? conversation.user2_id
      : conversation.user1_id;

    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO messages (conversation_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [conversation_id, req.user.id, receiver_id, content.trim()]
    );

    await conn.query(
      'UPDATE conversations SET last_message = ?, last_msg_at = NOW() WHERE id = ?',
      [content.trim().slice(0, 200), conversation_id]
    );

    await conn.commit();

    const [newMsg] = await db.query(
      `SELECT m.*, u.name AS sender_name, u.profile_photo AS sender_photo
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
      [result.insertId]
    );

    const message = newMsg[0];

    // Emit real-time via Socket.io
    if (global.io) {
      global.io.to(`user_${receiver_id}`).emit('new_message', message);
      global.io.to(`user_${req.user.id}`).emit('message_sent', message);
    }

    // Notification for receiver
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      [receiver_id, 'new_message', `New message from ${req.user.name}`, content.trim().slice(0, 100)]
    );

    return res.status(201).json(message);

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Send message error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  } finally {
    conn.release();
  }
});

// ── GET /api/chat/whatsapp/:userId ────────────────────────────────────────
// Get WhatsApp link for a user
router.get('/whatsapp/:userId', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, phone FROM users WHERE id = ? AND is_banned = 0',
      [req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    try {
      const normalized = normalizeKenyanPhone(user.phone);
      const waPhone    = normalized.replace('+', '');
      return res.json({
        name:         user.name,
        whatsappLink: `https://wa.me/${waPhone}`,
        phone:        user.phone,
      });
    } catch {
      return res.status(400).json({ error: 'Invalid phone number for WhatsApp' });
    }
  } catch (err) {
    console.error('WhatsApp link error:', err);
    return res.status(500).json({ error: 'Failed to generate WhatsApp link' });
  }
});

// ── GET /api/chat/unread-count ─────────────────────────────────────────────
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );
    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
