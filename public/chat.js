// Session sirf URL query param se milta hai — koi localStorage/sessionStorage use nahi hota.
const params = new URLSearchParams(window.location.search);
const myPhone = params.get('phone');

if (!myPhone) {
  window.location.href = '/index.html';
}

document.getElementById('myPhone').textContent = myPhone;

let activeUser = null;
let lastMessageTime = null;
let pollTimer = null;

const userListEl = document.getElementById('userList');
const messagesEl = document.getElementById('messages');
const chatHeaderEl = document.getElementById('chatHeader');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

async function loadUsers() {
  try {
    const resp = await fetch('/api/users?exclude=' + encodeURIComponent(myPhone));
    const data = await resp.json();
    userListEl.innerHTML = '';

    if (!data.success || data.users.length === 0) {
      userListEl.innerHTML = '<div class="empty">कोई और user register nahi hai</div>';
      return;
    }

    data.users.forEach((phone) => {
      const div = document.createElement('div');
      div.className = 'user-item' + (phone === activeUser ? ' active' : '');
      div.textContent = phone;
      div.addEventListener('click', () => openConversation(phone));
      userListEl.appendChild(div);
    });
  } catch (err) {
    userListEl.innerHTML = '<div class="empty">Users load nahi ho paye</div>';
  }
}

function renderMessage(msg) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (msg.from === myPhone ? 'sent' : 'received');
  const time = new Date(msg.createdAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  bubble.innerHTML = escapeHtml(msg.text) + '<span class="time">' + time + '</span>';
  messagesEl.appendChild(bubble);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function openConversation(phone) {
  activeUser = phone;
  chatHeaderEl.textContent = phone;
  messagesEl.innerHTML = '';
  messageForm.style.display = 'flex';
  lastMessageTime = null;

  // sidebar me active highlight update
  document.querySelectorAll('.user-item').forEach((el) => {
    el.classList.toggle('active', el.textContent === phone);
  });

  await fetchMessages(true);

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => fetchMessages(false), 3000);
}

async function fetchMessages(scrollToBottom) {
  if (!activeUser) return;
  try {
    let url = '/api/messages?user1=' + encodeURIComponent(myPhone) + '&user2=' + encodeURIComponent(activeUser);
    if (lastMessageTime) url += '&after=' + encodeURIComponent(lastMessageTime);

    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.success || data.messages.length === 0) return;

    data.messages.forEach((msg) => {
      renderMessage(msg);
      lastMessageTime = msg.createdAt;
    });

    if (scrollToBottom || true) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (err) {
    // agla poll try karega, chup-chaap ignore
  }
}

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeUser) return;

  messageInput.value = '';
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: myPhone, to: activeUser, text }),
    });
    await fetchMessages(true);
  } catch (err) {
    alert('Message bhej nahi paya, dobara try karein');
  }
});

loadUsers();
setInterval(loadUsers, 5000); // naye registered users ke liye list refresh
