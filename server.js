require('dotenv').config();

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const jwt         = require('jsonwebtoken');
const db          = require('./database/db');

const app    = express();
const server = http.createServer(app);

// ── Socket.io setup ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout:  60000,
  pingInterval: 25000,
});

// Make io accessible to routes via app and global
app.set('io', io);
global.io = io;

// ── Security & Parsing ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'maps.googleapis.com', 'cdn.socket.io'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'maps.googleapis.com', 'maps.gstatic.com', '*.ggpht.com'],
      connectSrc:  ["'self'", 'maps.googleapis.com', 'wa.me'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many auth attempts. Please wait 15 minutes.' },
  skipSuccessfulRequests: true,
});

const mpesaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message: { error: 'Too many payment requests. Please wait a moment.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login',            authLimiter);
app.use('/api/auth/register',         authLimiter);
app.use('/api/auth/forgot-password',  authLimiter);
app.use('/api/auth/reset-password',   authLimiter);
app.use('/api/mpesa/',                mpesaLimiter);

// ── Static Files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/hostels',       require('./routes/hostels'));
app.use('/api/booking',       require('./routes/booking'));
app.use('/api/mpesa',         require('./routes/mpesa'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/university',    require('./routes/university'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── SPA Catch-all ─────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Socket.io Auth & Rooms ────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded   = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId   = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`Socket connected: user ${userId}`);

  // Join personal room for targeted events
  socket.join(`user_${userId}`);

  // ── Typing indicator ──────────────────────────────────────────────────
  socket.on('typing_start', ({ conversationId }) => {
    socket.to(`conv_${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
    });
  });

  socket.on('typing_stop', ({ conversationId }) => {
    socket.to(`conv_${conversationId}`).emit('user_stopped_typing', {
      userId,
      conversationId,
    });
  });

  // ── Join conversation room ────────────────────────────────────────────
  socket.on('join_conversation', async ({ conversationId }) => {
    try {
      // Verify user belongs to this conversation
      const [conv] = await db.query(
        'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversationId, userId, userId]
      );
      if (conv.length) {
        socket.join(`conv_${conversationId}`);
      }
    } catch (err) {
      console.error('Join conversation error:', err);
    }
  });

  socket.on('leave_conversation', ({ conversationId }) => {
    socket.leave(`conv_${conversationId}`);
  });

  // ── Send message via socket ────────────────────────────────────────────
  socket.on('send_message', async ({ conversationId, content }) => {
    if (!content?.trim() || !conversationId) return;

    try {
      const [conv] = await db.query(
        'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversationId, userId, userId]
      );
      if (!conv.length) return;

      const conversation = conv[0];
      const receiver_id  = conversation.user1_id === userId
        ? conversation.user2_id
        : conversation.user1_id;

      const [result] = await db.query(
        'INSERT INTO messages (conversation_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
        [conversationId, userId, receiver_id, content.trim()]
      );

      await db.query(
        'UPDATE conversations SET last_message = ?, last_msg_at = NOW() WHERE id = ?',
        [content.trim().slice(0, 200), conversationId]
      );

      const [newMsg] = await db.query(
        `SELECT m.*, u.name AS sender_name, u.profile_photo AS sender_photo
         FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
        [result.insertId]
      );

      const message = newMsg[0];

      // Emit to both sides
      io.to(`conv_${conversationId}`).emit('new_message', message);
      io.to(`user_${receiver_id}`).emit('new_message_notification', {
        from:           message.sender_name,
        preview:        content.trim().slice(0, 80),
        conversationId,
      });

    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  // ── Mark messages read ─────────────────────────────────────────────────
  socket.on('mark_read', async ({ conversationId }) => {
    try {
      await db.query(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0',
        [conversationId, userId]
      );
      io.to(`conv_${conversationId}`).emit('messages_read', { conversationId, userId });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: user ${userId}`);
  });

  socket.on('error', (err) => {
    console.error(`Socket error for user ${userId}:`, err.message);
  });
});

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   🎓  HostelHub Server Running                        ║
╠══════════════════════════════════════════════════════╣
║  Local:      http://localhost:${PORT}                   ║
║  Roles:      student | owner | admin | university     ║
║  Env:        ${(process.env.NODE_ENV || 'development').padEnd(10)}                       ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
