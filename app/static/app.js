const loginView = document.querySelector('#login-view');
const appShell = document.querySelector('#app-shell');
const messagesView = document.querySelector('#messages');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const speechInput = document.querySelector('#voice-transcript');
const speechToggle = document.querySelector('#voice-toggle');
const speechRecognitionAvailable = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
let activeView = 'home';
let conversationId = null;
let conversationTitle = 'Percakapan baru';
let lastUserMessage = '';
let reminderCache = [];
let showCompletedReminders = false;
let activeRecognition = null;
let isListening = false;
let lastVoiceReply = '';
let toastTimer = 0;
let reminderTimer = 0;
let installPrompt = null;
let conversationSearchTimer = 0;

const allowedViews = new Set(['home', 'chat', 'voice', 'memory', 'reminders', 'settings']);

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Permintaan gagal. Coba lagi.');
  return data;
}

function confirmDelete(title, message) {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-description').textContent = message;
  dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
    dialog.querySelector('#confirm-cancel').focus();
  });
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function showInlineError(selector, message) {
  const element = document.querySelector(selector);
  element.textContent = message;
  element.hidden = false;
}

function clearInlineError(selector) {
  const element = document.querySelector(selector);
  element.textContent = '';
  element.hidden = true;
}

function updateTitle(view) {
  const title = document.querySelector(`#${view}-title`);
  if (title && view !== 'chat') title.focus({ preventScroll: true });
  else if (view === 'chat') document.querySelector('#chat-title').focus({ preventScroll: true });
}

function setView(view, { fromHash = false, focus = true } = {}) {
  if (!allowedViews.has(view)) view = 'home';
  activeView = view;
  document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `${view}-view`; });
  document.querySelectorAll('.bottom-nav [data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (!fromHash && window.location.hash !== `#${view}`) window.history.replaceState(null, '', `#${view}`);
  if (focus) updateTitle(view);
  if (view === 'chat') loadConversations(document.querySelector('#history-search').value).catch(showChatError);
  if (view === 'memory') loadMemories();
  if (view === 'reminders') loadReminders();
  if (view === 'settings') updateDeviceSettings();
}

function showLogin() {
  appShell.hidden = true;
  loginView.hidden = false;
  document.querySelector('#password').focus();
}

async function showApp() {
  loginView.hidden = true;
  appShell.hidden = false;
  const initialView = window.location.hash.slice(1);
  setView(allowedViews.has(initialView) ? initialView : 'home', { focus: false });
  document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());
  await Promise.allSettled([loadConversations(), loadMemories(), loadReminders()]);
  checkDueReminders();
  if (!reminderTimer) reminderTimer = window.setInterval(checkDueReminders, 45_000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

function createMessage(role, content, { actions = true } = {}) {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  item.setAttribute('aria-label', role === 'user' ? 'Pesan Anda' : 'Balasan Nara');
  const label = document.createElement('span');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'Kamu' : 'Nara';
  const body = document.createElement('div');
  body.textContent = content;
  item.append(label, body);
  if (role === 'assistant' && actions) {
    const actionRow = document.createElement('div');
    actionRow.className = 'message-actions';
    const remember = document.createElement('button');
    remember.type = 'button';
    remember.textContent = 'Simpan ke memori';
    remember.addEventListener('click', async () => {
      remember.disabled = true;
      try {
        await api('/api/memories', {
          method: 'POST',
          body: JSON.stringify({ content, conversation_id: conversationId }),
        });
        remember.textContent = 'Tersimpan';
        await loadMemories();
        showToast('Balasan Nara ditambahkan ke memori.');
      } catch (error) {
        remember.disabled = false;
        showToast(error.message);
      }
    });
    const remind = document.createElement('button');
    remind.type = 'button';
    remind.textContent = 'Buat pengingat';
    remind.addEventListener('click', () => {
      document.querySelector('#reminder-title').value = lastUserMessage.slice(0, 160);
      setDefaultReminderTime();
      setView('reminders');
      document.querySelector('#reminder-title').focus();
    });
    actionRow.append(remember, remind);
    item.append(actionRow);
  }
  return item;
}

function addMessage(role, content, options = {}) {
  document.querySelector('#welcome').hidden = true;
  const item = createMessage(role, content, options);
  messagesView.append(item);
  messagesView.scrollTop = messagesView.scrollHeight;
  return item;
}

function resetMessages() {
  messagesView.querySelectorAll('.message').forEach(item => item.remove());
  document.querySelector('#welcome').hidden = false;
  document.querySelector('#active-chat-title').textContent = 'Percakapan baru';
}

function renderConversationButton(item, active = false) {
  const row = document.createElement('div');
  row.className = `conversation-item${active ? ' active' : ''}`;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'conversation-open';
  open.textContent = item.title || 'Percakapan baru';
  open.setAttribute('aria-label', `Buka percakapan: ${item.title || 'Percakapan baru'}`);
  open.addEventListener('click', () => openConversation(item.id, item.title));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete-chat';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Hapus percakapan: ${item.title || 'Percakapan baru'}`);
  remove.addEventListener('click', async () => {
    const title = item.title || 'Percakapan ini';
    if (!await confirmDelete('Hapus percakapan?', `“${title}” dan seluruh pesannya akan dihapus. Memori tersimpan tetap ada.`)) return;
    try {
      await api(`/api/conversations/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (conversationId === item.id) startNewChat({ focus: false });
      await loadConversations(document.querySelector('#history-search').value);
      showToast('Percakapan sudah dihapus.');
    } catch (error) { showChatError(error.message); }
  });
  row.append(open, remove);
  return row;
}

async function loadConversations(query = '') {
  const search = query.trim();
  const suffix = search ? `?q=${encodeURIComponent(search)}` : '';
  const rows = await api(`/api/conversations${suffix}`);
  const list = document.querySelector('#conversation-list');
  const recent = document.querySelector('#home-recent');
  list.replaceChildren();
  recent.replaceChildren();
  document.querySelector('#history-count').textContent = String(rows.length);
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = search ? 'Tidak ada percakapan yang cocok.' : 'Belum ada percakapan. Mulai chat pertamamu dengan Nara.';
    list.append(empty);
    const recentEmpty = empty.cloneNode(true);
    recentEmpty.textContent = 'Belum ada percakapan. Chat pertamamu akan muncul di sini.';
    recent.append(recentEmpty);
    return rows;
  }
  for (const item of rows) {
    list.append(renderConversationButton(item, item.id === conversationId));
    if (recent.children.length < 3) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-card';
      const icon = document.createElement('span');
      icon.className = 'recent-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '▤';
      const label = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.title || 'Percakapan baru';
      const date = document.createElement('small');
      date.textContent = formatDate(item.created_at);
      label.append(title, date);
      const arrow = document.createElement('span');
      arrow.className = 'card-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      button.append(icon, label, arrow);
      button.addEventListener('click', () => openConversation(item.id, item.title));
      recent.append(button);
    }
  }
  return rows;
}

async function openConversation(id, title) {
  try {
    const rows = await api(`/api/conversations/${encodeURIComponent(id)}/messages`);
    conversationId = id;
    conversationTitle = title || 'Percakapan';
    document.querySelector('#chat-title').textContent = conversationTitle;
    document.querySelector('#active-chat-title').textContent = conversationTitle;
    messagesView.querySelectorAll('.message').forEach(item => item.remove());
    document.querySelector('#welcome').hidden = rows.length > 0;
    lastUserMessage = [...rows].reverse().find(row => row.role === 'user')?.content || '';
    for (const row of rows) addMessage(row.role, row.content);
    document.querySelector('#history-panel').open = false;
    setView('chat');
  } catch (error) { showToast(error.message); }
}

function startNewChat({ focus = true } = {}) {
  conversationId = null;
  conversationTitle = 'Percakapan baru';
  lastUserMessage = '';
  resetMessages();
  document.querySelector('#history-panel').open = false;
  if (activeView !== 'chat') setView('chat', { focus });
  if (focus) messageInput.focus();
  loadConversations(document.querySelector('#history-search').value).catch(showChatError);
}

function showChatError(message) { showInlineError('#chat-error', message); }

async function sendChat(rawText, { source = 'chat' } = {}) {
  const text = rawText.trim();
  if (!text) return null;
  lastUserMessage = text;
  clearInlineError('#chat-error');
  sendButton.disabled = true;
  if (source === 'chat') messageInput.disabled = true;
  const userMessage = addMessage('user', text);
  const waiting = addMessage('assistant', 'Nara sedang memikirkan jawabannya…', { actions: false });
  waiting.setAttribute('role', 'status');
  try {
    const result = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text, conversation_id: conversationId }),
    });
    waiting.remove();
    conversationId = result.conversation_id;
    conversationTitle = text.slice(0, 80);
    document.querySelector('#chat-title').textContent = conversationTitle;
    document.querySelector('#active-chat-title').textContent = conversationTitle;
    addMessage('assistant', result.reply);
    if (source === 'voice') {
      lastVoiceReply = result.reply;
      document.querySelector('#voice-reply-text').textContent = result.reply;
      document.querySelector('#voice-reply-card').hidden = false;
      document.querySelector('#voice-status').textContent = 'Nara sudah membalas.';
      speechInput.value = '';
      updateVoiceSendButton();
      setView('voice', { focus: false });
    }
    await Promise.allSettled([loadConversations(document.querySelector('#history-search').value), loadMemories()]);
    return result;
  } catch (error) {
    userMessage.remove();
    waiting.remove();
    document.querySelector('#welcome').hidden = messagesView.querySelectorAll('.message').length > 0;
    showChatError(error.message);
    if (source === 'voice') document.querySelector('#voice-status').textContent = 'Pesan belum terkirim. Periksa koneksi lalu coba lagi.';
    return null;
  } finally {
    sendButton.disabled = false;
    if (source === 'chat') {
      messageInput.disabled = false;
      messageInput.focus();
    }
  }
}

async function loadMemories() {
  try {
    const rows = await api('/api/memories');
    const list = document.querySelector('#memory-screen-list');
    list.replaceChildren();
    const count = rows.length;
    document.querySelector('#memory-count').textContent = count ? `${count} hal tersimpan` : 'Belum ada memori tersimpan';
    document.querySelector('#memory-total').textContent = `${count} memori`;
    if (!count) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Memori penting akan muncul setelah Nara menemukannya di percakapan. Kamu bisa menghapusnya kapan saja.';
      list.append(empty);
    }
    for (const memory of rows) {
      const row = document.createElement('article');
      row.className = 'memory-row';
      const icon = document.createElement('span');
      icon.className = 'quick-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✧';
      const text = document.createElement('p');
      text.textContent = memory.content;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-memory';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Hapus memori ini');
      remove.addEventListener('click', async () => {
        if (!await confirmDelete('Hapus memori?', 'Memori ini akan dihapus dari server dan tidak lagi dipakai oleh Nara.')) return;
        try {
          await api(`/api/memories/${memory.id}`, { method: 'DELETE' });
          await loadMemories();
          showToast('Memori sudah dihapus.');
        } catch (error) { showInlineError('#memory-error', error.message); }
      });
      row.append(icon, text, remove);
      list.append(row);
    }
    return rows;
  } catch (error) {
    showInlineError('#memory-error', error.message);
    return [];
  }
}

function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return 'Baru saja';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak diketahui';
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

function formatDateTime(value) {
  return formatDate(value, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function setDefaultReminderTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  document.querySelector('#reminder-due').value = local.toISOString().slice(0, 16);
}

async function loadReminders() {
  try {
    reminderCache = await api('/api/reminders');
    renderReminders();
    checkDueReminders();
    return reminderCache;
  } catch (error) {
    showInlineError('#reminder-error', error.message);
    return [];
  }
}

function renderReminders() {
  const list = document.querySelector('#reminder-list');
  list.replaceChildren();
  const active = reminderCache.filter(item => !item.completed);
  const completed = reminderCache.filter(item => item.completed);
  document.querySelector('#reminder-count').textContent = active.length ? `${active.length} pengingat aktif` : 'Buat pengingat baru';
  document.querySelector('#reminder-total').textContent = `${active.length} aktif`;
  document.querySelector('#show-completed').setAttribute('aria-pressed', String(showCompletedReminders));
  document.querySelector('#show-completed').textContent = showCompletedReminders ? 'Sembunyikan selesai' : `Tampilkan selesai${completed.length ? ` (${completed.length})` : ''}`;
  const visible = [...active, ...(showCompletedReminders ? completed : [])];
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Belum ada pengingat. Tambahkan satu di atas agar hal penting tidak terlewat.';
    list.append(empty);
  }
  for (const item of visible) {
    const row = document.createElement('article');
    row.className = `reminder-row${item.completed ? ' done' : ''}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'reminder-check';
    check.checked = item.completed;
    check.setAttribute('aria-label', item.completed ? `Tandai belum selesai: ${item.title}` : `Tandai selesai: ${item.title}`);
    check.addEventListener('change', () => updateReminder(item.id, check.checked));
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const details = document.createElement('small');
    const repeatText = item.repeat === 'daily' ? ' · setiap hari' : item.repeat === 'weekly' ? ' · setiap minggu' : '';
    details.textContent = `${formatDateTime(item.due_at)}${repeatText}`;
    text.append(title, details);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-memory';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Hapus pengingat: ${item.title}`);
    remove.addEventListener('click', () => deleteReminder(item));
    row.append(check, text, remove);
    list.append(row);
  }
}

async function updateReminder(id, completed) {
  try {
    const result = await api(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) });
    await loadReminders();
    showToast(result.repeat !== 'none' && completed ? 'Pengingat rutin dijadwalkan lagi.' : completed ? 'Pengingat ditandai selesai.' : 'Pengingat diaktifkan kembali.');
  } catch (error) { showInlineError('#reminder-error', error.message); }
}

async function deleteReminder(item) {
  if (!await confirmDelete('Hapus pengingat?', `“${item.title}” akan dihapus.`)) return;
  try {
    await api(`/api/reminders/${item.id}`, { method: 'DELETE' });
    await loadReminders();
    showToast('Pengingat sudah dihapus.');
  } catch (error) { showInlineError('#reminder-error', error.message); }
}

function checkDueReminders() {
  if (appShell.hidden) return;
  const now = Date.now();
  for (const item of reminderCache) {
    if (item.completed || new Date(item.due_at).getTime() > now) continue;
    const key = `nara-notified-${item.id}-${item.due_at}`;
    if (sessionStorage.getItem(key)) continue;
    sessionStorage.setItem(key, '1');
    showToast(`Pengingat: ${item.title}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Pengingat Nara', { body: item.title, icon: '/static/icon.svg', tag: key }); } catch { /* Browser does not allow page notifications here. */ }
    }
  }
}

function updateDeviceSettings() {
  const notificationStatus = document.querySelector('#notification-status');
  const notificationButton = document.querySelector('#enable-notifications');
  if (!('Notification' in window)) {
    notificationStatus.textContent = 'Browser ini tidak mendukung notifikasi.';
    notificationButton.disabled = true;
  } else if (Notification.permission === 'granted') {
    notificationStatus.textContent = 'Izin notifikasi sudah aktif di perangkat ini.';
    notificationButton.textContent = 'Aktif';
    notificationButton.disabled = true;
  } else if (Notification.permission === 'denied') {
    notificationStatus.textContent = 'Izin ditolak. Ubah izin situs melalui pengaturan browser.';
    notificationButton.textContent = 'Ditolak';
    notificationButton.disabled = true;
  } else {
    notificationStatus.textContent = 'Pengingat dapat memunculkan notifikasi saat aplikasi terbuka.';
    notificationButton.disabled = false;
    notificationButton.textContent = 'Aktifkan';
  }
}

async function exportData() {
  const button = document.querySelector('#export-data');
  button.disabled = true;
  try {
    const data = await api('/api/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `nara-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    document.querySelector('#settings-status').textContent = 'Ekspor data berhasil diunduh.';
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; }
}

function updateVoiceSendButton() {
  document.querySelector('#voice-send').disabled = !speechInput.value.trim() || isListening;
}

function stopListening() {
  if (activeRecognition && isListening) activeRecognition.stop();
  isListening = false;
  speechToggle.setAttribute('aria-pressed', 'false');
  speechToggle.setAttribute('aria-label', 'Mulai merekam');
  speechToggle.querySelector('small').textContent = 'Mulai bicara';
  document.querySelector('#voice-orb').classList.remove('is-listening');
  updateVoiceSendButton();
}

function startListening() {
  clearInlineError('#voice-error');
  if (!speechRecognitionAvailable) {
    showInlineError('#voice-error', 'Fitur transkrip suara tidak tersedia di browser ini. Kamu masih bisa mengetik transkrip pada kotak di atas.');
    document.querySelector('#voice-status').textContent = 'Browser belum mendukung mikrofon.';
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  activeRecognition = new Recognition();
  activeRecognition.lang = 'id-ID';
  activeRecognition.interimResults = true;
  activeRecognition.continuous = false;
  activeRecognition.maxAlternatives = 1;
  speechInput.dataset.finalTranscript = speechInput.value.trim();
  activeRecognition.onstart = () => {
    isListening = true;
    speechToggle.setAttribute('aria-pressed', 'true');
    speechToggle.setAttribute('aria-label', 'Berhenti merekam');
    speechToggle.querySelector('small').textContent = 'Berhenti';
    document.querySelector('#voice-orb').classList.add('is-listening');
    document.querySelector('#voice-status').textContent = 'Aku mendengarkan…';
    updateVoiceSendButton();
  };
  activeRecognition.onresult = event => {
    let finalText = '';
    let interimText = '';
    for (let index = 0; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) finalText += event.results[index][0].transcript;
      else interimText += event.results[index][0].transcript;
    }
    const existing = speechInput.dataset.finalTranscript || '';
    speechInput.value = [existing, finalText].filter(Boolean).join(' ').trim();
    speechInput.dataset.interimTranscript = interimText;
    document.querySelector('#voice-status').textContent = interimText ? `Mendengar: ${interimText}` : 'Transkrip siap diperiksa.';
    updateVoiceSendButton();
  };
  activeRecognition.onerror = event => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showInlineError('#voice-error', 'Izin mikrofon ditolak. Izinkan mikrofon pada pengaturan situs browser.');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showInlineError('#voice-error', 'Transkrip suara gagal. Coba lagi atau ketik pesannya.');
    }
    document.querySelector('#voice-status').textContent = 'Aku belum menerima suara.';
  };
  activeRecognition.onend = () => {
    isListening = false;
    speechToggle.setAttribute('aria-pressed', 'false');
    speechToggle.setAttribute('aria-label', 'Mulai merekam');
    speechToggle.querySelector('small').textContent = 'Mulai bicara';
    document.querySelector('#voice-orb').classList.remove('is-listening');
    speechInput.dataset.finalTranscript = speechInput.value;
    if (speechInput.value.trim()) document.querySelector('#voice-status').textContent = 'Transkrip siap diperiksa.';
    updateVoiceSendButton();
  };
  try { activeRecognition.start(); }
  catch { showInlineError('#voice-error', 'Mikrofon sedang digunakan. Tunggu sebentar lalu coba lagi.'); }
}

function speakReply() {
  if (!lastVoiceReply) {
    showToast('Belum ada balasan Nara untuk dibacakan.');
    return;
  }
  if (!('speechSynthesis' in window)) {
    showInlineError('#voice-error', 'Browser ini tidak mendukung pembacaan suara.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lastVoiceReply);
  utterance.lang = 'id-ID';
  window.speechSynthesis.speak(utterance);
  document.querySelector('#voice-status').textContent = 'Nara sedang membacakan jawabannya.';
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
    await showApp();
  } catch (reason) {
    error.textContent = reason.message;
    error.hidden = false;
  } finally { button.disabled = false; }
});

document.querySelector('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  const result = await sendChat(text);
  if (!result) messageInput.value = text;
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
});
messageInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    document.querySelector('#chat-form').requestSubmit();
  }
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', event => {
  if (event.currentTarget instanceof HTMLAnchorElement) event.preventDefault();
  const view = event.currentTarget.dataset.view;
  if (event.currentTarget.id !== 'new-chat') setView(view);
}));
document.querySelector('#new-chat').addEventListener('click', () => startNewChat());
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  messageInput.value = button.dataset.prompt;
  document.querySelector('#chat-form').requestSubmit();
}));
document.querySelector('#history-search').addEventListener('input', event => {
  window.clearTimeout(conversationSearchTimer);
  conversationSearchTimer = window.setTimeout(() => loadConversations(event.currentTarget.value).catch(showChatError), 220);
});

document.querySelector('#reminder-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearInlineError('#reminder-error');
  const button = event.currentTarget.querySelector('button[type=submit]');
  button.disabled = true;
  const payload = {
    title: document.querySelector('#reminder-title').value.trim(),
    due_at: new Date(document.querySelector('#reminder-due').value).toISOString(),
    repeat: document.querySelector('#reminder-repeat').value,
  };
  try {
    await api('/api/reminders', { method: 'POST', body: JSON.stringify(payload) });
    event.currentTarget.reset();
    setDefaultReminderTime();
    await loadReminders();
    showToast('Pengingat disimpan di server pribadimu.');
  } catch (error) { showInlineError('#reminder-error', error.message); }
  finally { button.disabled = false; }
});

document.querySelector('#show-completed').addEventListener('click', event => {
  showCompletedReminders = !showCompletedReminders;
  renderReminders();
  event.currentTarget.setAttribute('aria-pressed', String(showCompletedReminders));
});
document.querySelector('#voice-toggle').addEventListener('click', () => isListening ? stopListening() : startListening());
speechInput.addEventListener('input', () => {
  speechInput.dataset.finalTranscript = speechInput.value;
  updateVoiceSendButton();
});
document.querySelector('#voice-clear').addEventListener('click', () => {
  stopListening();
  speechInput.value = '';
  speechInput.dataset.finalTranscript = '';
  clearInlineError('#voice-error');
  document.querySelector('#voice-status').textContent = 'Hai, aku mendengarkan.';
  updateVoiceSendButton();
  speechInput.focus();
});
document.querySelector('#voice-send').addEventListener('click', async () => {
  const text = speechInput.value.trim();
  if (!text) return;
  document.querySelector('#voice-send').disabled = true;
  await sendChat(text, { source: 'voice' });
  updateVoiceSendButton();
});
document.querySelector('#voice-speak').addEventListener('click', speakReply);
document.querySelector('#voice-reply-play').addEventListener('click', speakReply);
document.querySelector('#reminder-due').addEventListener('input', () => clearInlineError('#reminder-error'));
document.querySelector('#export-data').addEventListener('click', exportData);
document.querySelector('#enable-notifications').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  try {
    await Notification.requestPermission();
    updateDeviceSettings();
    if (Notification.permission === 'granted') showToast('Notifikasi pengingat diaktifkan.');
  } catch { showToast('Browser tidak dapat meminta izin notifikasi.'); }
});
document.querySelector('#logout').addEventListener('click', async () => {
  stopListening();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  try { await api('/api/logout', { method: 'POST' }); }
  finally { appShell.hidden = true; showLogin(); }
});

window.addEventListener('hashchange', () => {
  const view = window.location.hash.slice(1);
  if (!appShell.hidden) setView(view, { fromHash: true });
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector('#install-app').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.querySelector('#install-app').hidden = true;
  showToast('Nara ditambahkan ke perangkat.');
});
document.querySelector('#install-app').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});

document.querySelector('#reminder-repeat').value = 'none';
setDefaultReminderTime();
document.querySelector('#voice-note').textContent = speechRecognitionAvailable
  ? 'Browser menyediakan transkrip mikrofon dan dapat memproses audio sesuai kebijakan vendornya. Periksa transkrip sebelum mengirim; hanya teks yang masuk ke API chat.'
  : 'Browser ini belum mendukung transkrip mikrofon. Kamu tetap bisa mengetik transkrip lalu mengirimkannya.';
api('/api/me').then(showApp).catch(showLogin);
