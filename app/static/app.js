const loginView = document.querySelector('#login-view');
const chatView = document.querySelector('#chat-view');
const messagesView = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const chatError = document.querySelector('#chat-error');
let conversationId = null;

function confirmDelete(title, message) {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-description').textContent = message;
  dialog.returnValue = '';
  dialog.showModal();
  dialog.querySelector('#confirm-cancel').focus();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Permintaan gagal. Coba lagi.');
  return data;
}

function showLogin() {
  chatView.hidden = true;
  loginView.hidden = false;
  document.querySelector('#password').focus();
}

function showChat() {
  loginView.hidden = true;
  chatView.hidden = false;
  loadSidebar();
  messageInput.focus();
}

function addMessage(role, content) {
  welcome.hidden = true;
  const item = document.createElement('article');
  item.className = `message ${role}`;
  const label = document.createElement('span');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'Anda' : 'Asisten';
  const body = document.createElement('div');
  body.textContent = content;
  item.append(label, body);
  messagesView.append(item);
  messagesView.scrollTop = messagesView.scrollHeight;
}

async function loadSidebar() {
  try {
    const [conversations, memories] = await Promise.all([
      api('/api/conversations'), api('/api/memories'),
    ]);
    const conversationList = document.querySelector('#conversation-list');
    conversationList.replaceChildren();
    for (const item of conversations) {
      const row = document.createElement('div');
      row.className = `conversation-item${item.id === conversationId ? ' active' : ''}`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'conversation-open';
      open.textContent = item.title;
      open.setAttribute('aria-label', `Buka percakapan: ${item.title}`);
      open.addEventListener('click', () => openConversation(item.id, item.title));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-chat';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Hapus percakapan: ${item.title}`);
      remove.addEventListener('click', async () => {
        if (!await confirmDelete('Hapus percakapan?', `Percakapan “${item.title}” dan seluruh pesannya akan dihapus. Memori tersimpan tetap ada.`)) return;
        try {
          await api(`/api/conversations/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
          if (conversationId === item.id) startNewChat();
          await loadSidebar();
        } catch (error) { showError(error.message); }
      });
      row.append(open, remove);
      conversationList.append(row);
    }
    const memoryList = document.querySelector('#memory-list');
    memoryList.replaceChildren();
    if (!memories.length) {
      const empty = document.createElement('p');
      empty.className = 'muted small-copy';
      empty.textContent = 'Memori akan tersimpan setelah Anda mengobrol.';
      memoryList.append(empty);
    }
    for (const memory of memories) {
      const row = document.createElement('div');
      row.className = 'memory-item';
      const text = document.createElement('span');
      text.className = 'memory-text';
      text.textContent = memory.content;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-memory';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Hapus memori ini');
      remove.addEventListener('click', async () => {
        if (!await confirmDelete('Hapus memori?', 'Memori ini akan dihapus dan tidak bisa dipulihkan.')) return;
        try {
          await api(`/api/memories/${memory.id}`, { method: 'DELETE' });
          await loadSidebar();
        } catch (error) { showError(error.message); }
      });
      row.append(text, remove);
      memoryList.append(row);
    }
  } catch (error) { showError(error.message); }
}

async function openConversation(id, title) {
  try {
    const items = await api(`/api/conversations/${encodeURIComponent(id)}/messages`);
    conversationId = id;
    document.querySelector('.sidebar').classList.remove('expanded');
    document.querySelector('#nav-toggle').setAttribute('aria-expanded', 'false');
    document.querySelector('#chat-title').textContent = title;
    messagesView.querySelectorAll('.message').forEach(item => item.remove());
    welcome.hidden = items.length > 0;
    for (const item of items) addMessage(item.role, item.content);
    await loadSidebar();
  } catch (error) { showError(error.message); }
}

function startNewChat() {
  conversationId = null;
  document.querySelector('#chat-title').textContent = 'Percakapan baru';
  messagesView.querySelectorAll('.message').forEach(item => item.remove());
  welcome.hidden = false;
  document.querySelector('.sidebar').classList.remove('expanded');
  document.querySelector('#nav-toggle').setAttribute('aria-expanded', 'false');
  messageInput.focus();
  loadSidebar();
}

function showError(message) {
  chatError.textContent = message;
  chatError.hidden = false;
}

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('#login-error');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  error.hidden = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: document.querySelector('#password').value }) });
    document.querySelector('#password').value = '';
    showChat();
  } catch (reason) {
    error.textContent = reason.message;
    error.hidden = false;
  } finally { button.disabled = false; }
});

document.querySelector('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  chatError.hidden = true;
  sendButton.disabled = true;
  addMessage('user', text);
  const pendingMessage = messagesView.lastElementChild;
  addMessage('assistant', 'Sedang menyiapkan jawaban…');
  const thinkingMessage = messagesView.lastElementChild;
  thinkingMessage.setAttribute('role', 'status');
  messageInput.value = '';
  messageInput.style.height = 'auto';
  try {
    const result = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text, conversation_id: conversationId }) });
    thinkingMessage.remove();
    conversationId = result.conversation_id;
    document.querySelector('#chat-title').textContent = text.slice(0, 80);
    addMessage('assistant', result.reply);
    await loadSidebar();
  } catch (error) {
    pendingMessage.remove();
    thinkingMessage.remove();
    welcome.hidden = messagesView.querySelectorAll('.message').length > 0;
    messageInput.value = text;
    showError(error.message);
  } finally { sendButton.disabled = false; messageInput.focus(); }
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
});
messageInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    document.querySelector('#chat-form').requestSubmit();
  }
});
document.querySelector('#new-chat').addEventListener('click', startNewChat);
document.querySelector('#nav-toggle').addEventListener('click', event => {
  const expanded = document.querySelector('.sidebar').classList.toggle('expanded');
  event.currentTarget.setAttribute('aria-expanded', String(expanded));
});
document.querySelector('#logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } finally { showLogin(); }
});

api('/api/me').then(showChat).catch(showLogin);
