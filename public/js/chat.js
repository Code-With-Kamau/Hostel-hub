// ── chat.js ──
const ChatModule = {
  socket: null, activeConv: null,
  init() {
    if (!AUTH.isLoggedIn() || this.socket) return;
    this.socket = io(CONFIG.SOCKET_URL, { auth: { token: AUTH.token }, transports: ['websocket','polling'] });
    this.socket.on('connect', () => {});
    this.socket.on('new_message', (msg) => {
      if (document.getElementById('chat-messages') && this.activeConv) {
        ChatPage.appendMsg(msg);
        this.socket.emit('mark_read', { conversation_id: this.activeConv });
      }
      refreshChatBadge();
    });
    this.socket.on('new_message_notification', (d) => { showToast(`💬 ${d.sender_name}: ${d.message}`, 'info'); refreshChatBadge(); });
    this.socket.on('user_typing', ({ userName, isTyping }) => {
      const el = document.getElementById('chat-typing');
      if (el) el.textContent = isTyping ? `${userName} is typing…` : '';
    });
  },
  send(receiverId, message, hostelId = null) {
    if (!this.socket || !message.trim()) return;
    const convId = [AUTH.user.id, receiverId].sort().join('_');
    this.socket.emit('send_message', { receiver_id: receiverId, message, hostel_id: hostelId, conversation_id: convId });
  },
  join(convId) { this.activeConv = convId; this.socket?.emit('join_conversation', convId); },
  typing(convId, is) { this.socket?.emit('typing', { conversation_id: convId, isTyping: is }); },
  openChat(userId, userName, hostelId = null) {
    if (!AUTH.isLoggedIn()) { navigate('login'); return; }
    navigate('chat');
    setTimeout(() => ChatPage.open(userId, userName, hostelId), 300);
  },
};

const ChatPage = {
  activeUserId: null, activeUserName: null, activeHostelId: null, typingTimer: null,

  async render() {
    if (!AUTH.isLoggedIn()) { navigate('login'); return; }
    document.getElementById('app-content').innerHTML = `
      <div class="chat-layout">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">💬 Messages</div>
          <div id="conv-list" style="overflow-y:auto;flex:1"><div style="padding:20px;text-align:center"><div class="loader-spinner" style="margin:0 auto;width:24px;height:24px;border-width:2px"></div></div></div>
        </div>
        <div id="chat-main-area" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--gray-400)">
          <div style="font-size:3.5rem">💬</div>
          <p style="margin-top:10px;font-size:.9rem">Select a conversation</p>
        </div>
      </div>`;
    this.loadConvs();
  },

  async loadConvs() {
    try {
      const res = await API.getConversations();
      const list = document.getElementById('conv-list');
      if (!list) return;
      const convs = res.data || [];
      if (!convs.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:.84rem">No conversations yet.<br/>Message a hostel owner to start.</div>'; return; }
      list.innerHTML = convs.map(c => `
        <div class="chat-conv-item${this.activeUserId===c.other_user_id?' active':''}" onclick="ChatPage.open(${c.other_user_id},'${c.other_user_name}',${c.hostel_id||'null'})">
          <img class="chat-conv-avatar" src="${c.other_user_photo||CONFIG.DEFAULT_AVATAR}" onerror="this.src='${CONFIG.DEFAULT_AVATAR}'" />
          <div style="flex:1;min-width:0">
            <div class="chat-conv-name">${c.other_user_name}</div>
            <div class="chat-conv-preview">${c.last_message||'No messages'}</div>
            ${c.hostel_title?`<div style="font-size:.7rem;color:var(--blue-500)">🏢 ${c.hostel_title}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.68rem;color:var(--gray-400)">${c.last_message_time?timeAgo(c.last_message_time):''}</div>
            ${c.unread_count>0?`<div class="chat-conv-unread">${c.unread_count}</div>`:''}
          </div>
        </div>`).join('');
    } catch(e) {}
  },

  async open(userId, userName, hostelId = null) {
    this.activeUserId = userId; this.activeUserName = userName; this.activeHostelId = hostelId;
    const convId = [AUTH.user.id, userId].sort().join('_');
    ChatModule.join(convId);
    const area = document.getElementById('chat-main-area');
    if (!area) return;
    area.className = 'chat-main';
    area.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;flex:1';
    area.innerHTML = `
      <div class="chat-header">
        <img src="${CONFIG.DEFAULT_AVATAR}" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />
        <div><div style="font-weight:700;font-size:.9rem">${userName}</div><div style="font-size:.72rem;color:var(--blue-500)" id="online-status">Active</div></div>
        ${hostelId?`<div style="margin-left:auto"><button class="btn btn-sm btn-outline" onclick="navigate('hostel',${hostelId})"><i class="fas fa-building"></i> Hostel</button></div>`:''}
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-typing" id="chat-typing" style="font-size:.72rem;color:var(--gray-400);padding:3px 18px;min-height:18px"></div>
      <div class="chat-input-area">
        <input class="chat-input" id="chat-input" placeholder="Type a message…" onkeydown="ChatPage.handleKey(event,${userId},'${convId}')" oninput="ChatPage.handleTyping('${convId}')" />
        <button class="chat-send-btn" onclick="ChatPage.sendMsg(${userId},'${convId}')"><i class="fas fa-paper-plane"></i></button>
      </div>`;
    document.querySelectorAll('.chat-conv-item').forEach(el => el.classList.toggle('active', el.textContent.includes(userName)));
    this.loadMsgs(convId);
  },

  async loadMsgs(convId) {
    const res = await API.getMessages(convId);
    const el = document.getElementById('chat-messages');
    if (!el) return;
    (res.data || []).forEach(m => this.appendMsg(m));
    el.scrollTop = el.scrollHeight;
    refreshChatBadge();
  },

  appendMsg(msg) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const sent = msg.sender_id === AUTH.user.id;
    const div = document.createElement('div');
    div.className = `chat-message ${sent?'sent':'received'}`;
    div.innerHTML = `${!sent?`<img class="chat-message-avatar" src="${CONFIG.DEFAULT_AVATAR}" style="width:28px;height:28px;border-radius:50%;flex-shrink:0" />`:''}
      <div class="chat-message-bubble">${msg.message}</div>
      <span class="chat-message-time">${timeAgo(msg.created_at)}</span>`;
    el.appendChild(div); el.scrollTop = el.scrollHeight;
  },

  handleKey(e, userId, convId) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); this.sendMsg(userId, convId); } },
  handleTyping(convId) {
    ChatModule.typing(convId, true);
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => ChatModule.typing(convId, false), 2000);
  },
  sendMsg(userId, convId) {
    const input = document.getElementById('chat-input');
    if (!input?.value.trim()) return;
    const msg = input.value.trim(); input.value = '';
    ChatModule.send(userId, msg, this.activeHostelId);
    ChatModule.typing(convId, false);
    this.appendMsg({ sender_id: AUTH.user.id, message: msg, created_at: new Date().toISOString() });
  },
};

async function refreshChatBadge() {
  if (!AUTH.isLoggedIn()) return;
  try {
    const res = await API.getUnread();
    const n = res.count || 0;
    const b = document.getElementById('chat-fab-badge');
    if (b) { b.textContent = n; b.style.display = n > 0 ? 'flex' : 'none'; }
  } catch(e) {}
}
