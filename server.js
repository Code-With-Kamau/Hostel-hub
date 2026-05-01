require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ── MIDDLEWARE ──
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300, skip: req => req.path.startsWith('/api/mpesa') }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 20, skip: req => !req.path.includes('/auth/login') && !req.path.includes('/auth/register') }));

// ── STATIC ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ROUTES ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hostels', require('./routes/hostels'));
app.use('/api/booking', require('./routes/booking'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/students', require('./routes/students'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

// ── SOCKET.IO ──
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try { socket.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user) {
    onlineUsers.set(socket.user.id, socket.id);
    io.emit('user_online', { userId: socket.user.id });
  }

  socket.on('join_conversation', (convId) => socket.join(convId));

  socket.on('send_message', async ({ receiver_id, message, hostel_id, conversation_id }) => {
    if (!socket.user) return;
    try {
      await db.execute('INSERT INTO messages (sender_id,receiver_id,hostel_id,conversation_id,message) VALUES (?,?,?,?,?)',
        [socket.user.id, receiver_id, hostel_id||null, conversation_id, message]);
      const msgObj = { sender_id: socket.user.id, receiver_id, message, hostel_id, conversation_id, created_at: new Date().toISOString(), sender_name: socket.user.name };
      io.to(conversation_id).emit('new_message', msgObj);
      const receiverSocket = onlineUsers.get(parseInt(receiver_id));
      if (receiverSocket) io.to(receiverSocket).emit('new_message_notification', { sender_name: socket.user.name, message: message.slice(0,60) });
    } catch (e) {}
  });

  socket.on('typing', ({ conversation_id, isTyping }) => {
    socket.to(conversation_id).emit('user_typing', { userName: socket.user?.name, isTyping });
  });

  socket.on('mark_read', ({ conversation_id }) => {
    if (socket.user) db.execute('UPDATE messages SET is_read=1 WHERE conversation_id=? AND receiver_id=?', [conversation_id, socket.user.id]).catch(()=>{});
  });

  socket.on('disconnect', () => {
    if (socket.user) { onlineUsers.delete(socket.user.id); io.emit('user_offline', { userId: socket.user.id }); }
  });
});

// ── SPA FALLBACK ──
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  else res.status(404).json({ success: false, message: 'Not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🎓 HostelHub Server Running             ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Local:    http://localhost:${PORT}           ║`);
  console.log('║  Roles:    student | owner | admin        ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
