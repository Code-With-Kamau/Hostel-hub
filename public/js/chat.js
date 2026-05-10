let chatSocket = null;
let currentConvId = null;

registerPage('chat', async (main, convId) => {
  if (!HH.isLoggedIn()) { showLoginModal(); return; }

  main.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar" id="chat-sidebar">
        <div class="chat-sidebar-header">
          <h3>💬 Messages</h3>
        </div>
        <div id="conv-list"><div class="spinner-container"><div class="spinner"></div></div></div>
      </div>
      <div class="chat-main" id="chat-main">
        <div class="chat-placeholder">
          <span>📨</span>
          <p>Select a conversation or start a new one</p>
        </div>
      </div>
    </div>`;

  await loadConversations(convId);
  initChatSocket();
  if (convId) openConversation(parseInt(convId));
});

async function loadConversations(activeId) {
  const el = document.getElementById('conv-list');
  if (!el) return;
  try {
    const convs = await HH.api('/chat/conversations');
    if (!convs.length) {
      el.innerHTML = `<div class="empty-state-sm"><p>No conversations yet</p></div>`;
      return;
    }
    el.innerHTML = convs.map(c => `
      <div class="conv-item ${c.id == activeId ? 'active' : ''}" id="conv-${c.id}" onclick="openConversation(${c.id})">
        <div class="conv-avatar">
          <img src="${HH.escapeHtml(c.other_photo || '/images/default-avatar.png')}" alt="" onerror="this.src='/images/default-avatar.png'">
          ${c.unread_count > 0 ? `<span class="unread-dot">${c.unread_count}</span>` : ''}
        </div>
        <div class="conv-info">
          <div class="conv-name">${HH.escapeHtml(c.other_name)}</div>
          ${c.hostel_name ? `<div class="conv-hostel">🏠 ${HH.escapeHtml(c.hostel_name)}</div>` : ''}
          <div class="conv-preview">${HH.escapeHtml((c.last_message || 'Start a conversation').slice(0, 50))}</div>
        </div>
        <div class="conv-meta">
          <span class="conv-time">${c.last_msg_at ? timeAgo(c.last_msg_at) : ''}</span>
        </div>
      </div>`).join('');
  } catch (err) { showError(el, err.message); }
}

async function openConversation(convId) {
  currentConvId = convId;

  // Mark active in sidebar
  document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.id === `conv-${convId}`));

  const chatMain = document.getElementById('chat-main');
  chatMain.innerHTML = `
    <div class="chat-header" id="chat-header">
      <div class="spinner-sm"></div> Loading...
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="spinner-container"><div class="spinner"></div></div>
    </div>
    <div class="chat-input-bar">
      <textarea id="chat-input" placeholder="Type a message..." rows="1"
        onkeydown="handleChatKeydown(event)"
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';notifyTyping()">
      </textarea>
      <button class="btn btn-primary" onclick="sendMessage()">Send ➤</button>
    </div>`;

  await loadMessages(convId);

  // Join socket room
  if (chatSocket) chatSocket.emit('join_conversation', { conversationId: convId });
}

async function loadMessages(convId) {
  const msgEl  = document.getElementById('chat-messages');
  const headEl = document.getElementById('chat-header');
  if (!msgEl) return;

  try {
    const messages = await HH.api(`/chat/messages/${convId}`);

    // Get conversation info from sidebar
    const convItem = document.getElementById(`conv-${convId}`);
    const otherName = convItem?.querySelector('.conv-name')?.textContent || 'User';

    if (headEl) {
      headEl.innerHTML = `
        <div class="chat-header-info">
          <strong>${HH.escapeHtml(otherName)}</strong>
        </div>
        <div class="chat-header-actions">
          <button class="btn btn-success btn-sm" onclick="openWhatsApp(${convId})">📱 WhatsApp</button>
        </div>`;
    }

    renderMessages(messages);

    // Remove unread badge in sidebar
    const dot = convItem?.querySelector('.unread-dot');
    if (dot) dot.remove();

    // Mark read via socket
    if (chatSocket) chatSocket.emit('mark_read', { conversationId: convId });

  } catch (err) {
    if (msgEl) showError(msgEl, err.message);
  }
}

function renderMessages(messages) {
  const el    = document.getElementById('chat-messages');
  const myId  = HH.getUser()?.id;
  if (!el) return;

  if (!messages.length) {
    el.innerHTML = `<div class="chat-empty"><p>No messages yet. Say hello! 👋</p></div>`;
    return;
  }

  el.innerHTML = messages.map(m => {
    const isMine = m.sender_id === myId;
    return `
      <div class="chat-msg ${isMine ? 'chat-msg-mine' : 'chat-msg-theirs'}">
        ${!isMine ? `<img class="msg-avatar" src="${HH.escapeHtml(m.sender_photo || '/images/default-avatar.png')}" alt="" onerror="this.src='/images/default-avatar.png'">` : ''}
        <div class="msg-bubble">
          <p>${HH.escapeHtml(m.content)}</p>
          <span class="msg-time">${timeAgo(m.created_at)} ${isMine ? (m.is_read ? '✓✓' : '✓') : ''}</span>
        </div>
      </div>`;
  }).join('');

  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input?.value.trim();
  if (!content || !currentConvId) return;

  input.value = '';
  input.style.height = 'auto';

  // Optimistic UI
  const myId   = HH.getUser()?.id;
  const msgEl  = document.getElementById('chat-messages');
  const tempId = 'temp-' + Date.now();
  const tempMsg = document.createElement('div');
  tempMsg.className = 'chat-msg chat-msg-mine';
  tempMsg.id        = tempId;
  tempMsg.innerHTML = `<div class="msg-bubble"><p>${HH.escapeHtml(content)}</p><span class="msg-time">sending...</span></div>`;
  msgEl?.appendChild(tempMsg);
  msgEl && (msgEl.scrollTop = msgEl.scrollHeight);

  try {
    // Send via socket
    if (chatSocket?.connected) {
      chatSocket.emit('send_message', { conversationId: currentConvId, content });
    } else {
      // Fallback: REST API
      await HH.api('/chat/messages', {
        method: 'POST',
        body: { conversation_id: currentConvId, content },
      });
    }
    document.getElementById(tempId)?.querySelector('.msg-time')?.textContent === 'sending...' &&
      (document.getElementById(tempId).querySelector('.msg-time').textContent = 'just now ✓');
  } catch (err) {
    document.getElementById(tempId)?.remove();
    showToast('Failed to send message: ' + err.message, 'error');
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

let typingTimer;
function notifyTyping() {
  if (chatSocket && currentConvId) {
    chatSocket.emit('typing_start', { conversationId: currentConvId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      chatSocket.emit('typing_stop', { conversationId: currentConvId });
    }, 1500);
  }
}

async function openWhatsApp(convId) {
  try {
    const convItem  = document.getElementById(`conv-${convId}`);
    const otherName = convItem?.querySelector('.conv-name')?.textContent || '';
    // Get WhatsApp link from conv data
    const convs = await HH.api('/chat/conversations');
    const conv  = convs.find(c => c.id == convId);
    if (!conv) return;

    const phone = conv.other_phone?.replace(/\+/,'').replace(/\s/g,'') || '';
    if (!phone) {
      showToast('No phone number available', 'warning');
      return;
    }
    window.open(`https://wa.me/${phone}?text=Hello ${encodeURIComponent(otherName)}, I found your contact on HostelHub.`, '_blank');
  } catch {}
}

function initChatSocket() {
  const token = HH.getToken();
  if (!token) return;

  chatSocket = io({ auth: { token } });

  chatSocket.on('connect', () => {
    if (currentConvId) chatSocket.emit('join_conversation', { conversationId: currentConvId });
  });

  chatSocket.on('new_message', (message) => {
    if (message.conversation_id === currentConvId) {
      const msgEl = document.getElementById('chat-messages');
      if (msgEl) {
        const myId  = HH.getUser()?.id;
        const isMine = message.sender_id === myId;
        const div = document.createElement('div');
        div.className = `chat-msg ${isMine ? 'chat-msg-mine' : 'chat-msg-theirs'}`;
        div.innerHTML = `
          ${!isMine ? `<img class="msg-avatar" src="${HH.escapeHtml(message.sender_photo || '/images/default-avatar.png')}" alt="" onerror="this.src='/images/default-avatar.png'">` : ''}
          <div class="msg-bubble">
            <p>${HH.escapeHtml(message.content)}</p>
            <span class="msg-time">${timeAgo(message.created_at)}</span>
          </div>`;
        msgEl.appendChild(div);
        msgEl.scrollTop = msgEl.scrollHeight;

        // Remove temp message if it exists
        const temps = msgEl.querySelectorAll('[id^="temp-"]');
        if (temps.length) temps[temps.length - 1].remove();

        chatSocket.emit('mark_read', { conversationId: currentConvId });
      }
    }
    // Update conv list preview
    const convItem = document.getElementById(`conv-${message.conversation_id}`);
    const preview  = convItem?.querySelector('.conv-preview');
    if (preview) preview.textContent = message.content.slice(0, 50);
    const convTime = convItem?.querySelector('.conv-time');
    if (convTime) convTime.textContent = 'just now';
  });

  chatSocket.on('user_typing', ({ userId, conversationId }) => {
    if (conversationId !== currentConvId) return;
    const msgEl = document.getElementById('chat-messages');
    if (!msgEl || document.getElementById('typing-indicator')) return;
    const div = document.createElement('div');
    div.id        = 'typing-indicator';
    div.className = 'chat-msg chat-msg-theirs';
    div.innerHTML = `<div class="msg-bubble typing"><span></span><span></span><span></span></div>`;
    msgEl.appendChild(div);
    msgEl.scrollTop = msgEl.scrollHeight;
  });

  chatSocket.on('user_stopped_typing', () => {
    document.getElementById('typing-indicator')?.remove();
  });

  chatSocket.on('new_message_notification', ({ from, preview }) => {
    showToast(`💬 New message from ${from}: ${preview}`, 'info', 4000);
    updateNotificationBell();
    loadConversations(currentConvId);
  });

  chatSocket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  chatSocket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

window.openConversation = openConversation;
window.sendMessage      = sendMessage;
window.handleChatKeydown = handleChatKeydown;
window.notifyTyping     = notifyTyping;
window.openWhatsApp     = openWhatsApp;
