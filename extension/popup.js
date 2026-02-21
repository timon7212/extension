/**
 * Popup — My Tasks (daily driver) + Account.
 *
 * Flow:
 *  1) No serverUrl → setup
 *  2) serverUrl, no token → login
 *  3) Token → show tabs: My Tasks | Account
 */

// ── DOM refs ──
const setupSection = document.getElementById('setup-section');
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');

const serverUrlInput = document.getElementById('server-url');
const testBtn = document.getElementById('test-btn');
const saveServerBtn = document.getElementById('save-server-btn');
const setupError = document.getElementById('setup-error');
const connectionStatus = document.getElementById('connection-status');

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

const gearBtn = document.getElementById('gear-btn');

let currentEmployee = null;
let serverUrl = '';

// ── Init ──
chrome.storage.local.get(['serverUrl', 'token'], async (data) => {
  if (!data.serverUrl) {
    showSetup();
    return;
  }

  serverUrl = data.serverUrl;

  if (!data.token) {
    showLogin(data.serverUrl);
    return;
  }

  try {
    const res = await fetchApi(data.serverUrl, 'GET', '/auth/me', null, data.token);
    currentEmployee = res.employee;
    showMain(data.serverUrl, res.employee, data.token);
  } catch {
    showLogin(data.serverUrl);
  }
});

// ── Gear → settings ──
gearBtn.addEventListener('click', () => {
  chrome.storage.local.get('serverUrl', (data) => {
    showSetup(data.serverUrl);
  });
});

// ── SETUP ──
testBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, '');
  setupError.textContent = '';
  connectionStatus.innerHTML = '';

  if (!url) { setupError.textContent = 'Enter server URL'; return; }

  testBtn.disabled = true;
  testBtn.textContent = '⏳ Testing...';

  try {
    const res = await fetch(`${url}/api/health`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json();
    if (json.status === 'ok') {
      connectionStatus.innerHTML = `<div class="status-bar status-ok"><span class="dot dot-green"></span>Connected ✓</div>`;
    } else {
      throw new Error('Unexpected');
    }
  } catch {
    connectionStatus.innerHTML = `<div class="status-bar status-err"><span class="dot dot-red"></span>Connection failed. Check URL and firewall.</div>`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '🔌 Test Connection';
  }
});

saveServerBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, '');
  setupError.textContent = '';
  if (!url) { setupError.textContent = 'Enter server URL'; return; }
  try { new URL(url); } catch { setupError.textContent = 'Invalid URL format'; return; }
  chrome.storage.local.set({ serverUrl: url }, () => {
    serverUrl = url;
    showLogin(url);
  });
});

// ── LOGIN ──
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  loginError.textContent = '';

  if (!email || !password) { loginError.textContent = 'Fill in all fields'; return; }

  loginBtn.disabled = true;
  loginBtn.textContent = '⏳...';

  try {
    const data = await chrome.storage.local.get('serverUrl');
    serverUrl = data.serverUrl;
    const res = await fetchApi(serverUrl, 'POST', '/auth/login', { email, password });
    currentEmployee = res.employee;
    chrome.storage.local.set({ token: res.token }, () => {
      showMain(serverUrl, res.employee, res.token);
    });
  } catch (err) {
    loginError.textContent = err.message || 'Login failed';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

// ── LOGOUT ──
logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove('token', () => {
    chrome.storage.local.get('serverUrl', (data) => {
      showLogin(data.serverUrl);
    });
  });
});

// ── Tabs ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
  });
});

// ── Screen switches ──
function hideAll() {
  setupSection.classList.remove('active');
  loginSection.classList.remove('active');
  mainSection.classList.remove('active');
}

function showSetup(currentUrl) {
  hideAll();
  setupSection.classList.add('active');
  serverUrlInput.value = currentUrl || '';
  connectionStatus.innerHTML = '';
  setupError.textContent = '';
}

function showLogin(sUrl) {
  hideAll();
  loginSection.classList.add('active');
  document.getElementById('current-server-display').textContent = `🖥️ ${sUrl}`;
  loginError.textContent = '';
}

function showMain(sUrl, employee, token) {
  hideAll();
  mainSection.classList.add('active');

  // Account tab
  document.getElementById('user-name').textContent = employee.name;
  document.getElementById('user-role').textContent = employee.role;
  document.getElementById('user-avatar').textContent = employee.name.charAt(0).toUpperCase();
  document.getElementById('server-status').innerHTML = `
    <div class="status-bar status-ok"><span class="dot dot-green"></span>${sUrl}</div>`;

  // Load tasks
  loadMyTasks(sUrl, token);
}

// ── Load My Tasks ──
async function loadMyTasks(sUrl, token) {
  const loadingEl = document.getElementById('tasks-loading');
  const listEl = document.getElementById('tasks-list');
  const badgeEl = document.getElementById('tasks-badge');

  loadingEl.style.display = 'block';
  listEl.innerHTML = '';

  try {
    const data = await fetchApi(sUrl, 'GET', '/tasks/my', null, token);

    loadingEl.style.display = 'none';

    // Badge
    const urgentCount = data.counts.overdue + data.counts.today;
    if (urgentCount > 0) {
      badgeEl.textContent = urgentCount;
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
    }

    // Stats row
    const statsEl = document.getElementById('user-stats');
    statsEl.innerHTML = `
      <div class="stat-mini">
        <div class="stat-mini-value">${data.counts.overdue}</div>
        <div class="stat-mini-label">Overdue</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-value">${data.counts.today}</div>
        <div class="stat-mini-label">Today</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-value">${data.counts.upcoming}</div>
        <div class="stat-mini-label">Upcoming</div>
      </div>`;

    if (data.counts.total === 0 || (data.counts.overdue === 0 && data.counts.today === 0 && data.counts.upcoming === 0)) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-text">All clear!</div>
          <div class="empty-state-sub">No pending tasks. Create tasks from LinkedIn profiles.</div>
        </div>`;
      return;
    }

    let html = '';

    if (data.overdue.length > 0) {
      html += `<div class="group-header overdue-g"><span class="pulse-dot"></span> Overdue (${data.overdue.length})</div>`;
      html += data.overdue.map(t => renderPopupTask(t, 'overdue')).join('');
    }

    if (data.today.length > 0) {
      html += `<div class="group-header today-g">📌 Today (${data.today.length})</div>`;
      html += data.today.map(t => renderPopupTask(t, 'today')).join('');
    }

    if (data.upcoming.length > 0) {
      html += `<div class="group-header upcoming-g">📅 Upcoming (${data.upcoming.length})</div>`;
      html += data.upcoming.map(t => renderPopupTask(t, 'upcoming')).join('');
    }

    listEl.innerHTML = html;

    // Attach click handlers
    listEl.querySelectorAll('.task-check').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        const newStatus = btn.dataset.to;
        btn.classList.add('done');
        btn.textContent = '✓';
        try {
          const tkn = (await chrome.storage.local.get('token')).token;
          await fetchApi(sUrl, 'PATCH', `/tasks/${taskId}`, { status: newStatus }, tkn);
          // Reload after short delay for visual feedback
          setTimeout(() => loadMyTasks(sUrl, tkn), 400);
        } catch (err) {
          console.error('Toggle task error:', err);
        }
      });
    });

    listEl.querySelectorAll('.task-lead-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

  } catch (err) {
    loadingEl.style.display = 'none';
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Failed to load tasks</div>
        <div class="empty-state-sub">${escHtml(err.message)}</div>
      </div>`;
  }
}

function renderPopupTask(task, urgency) {
  const due = relativeDate(task.due_at);
  const dueClass = urgency === 'overdue' ? 'overdue-text' : urgency === 'today' ? 'today-text' : 'upcoming-text';

  return `
    <div class="task-item ${urgency}">
      <button class="task-check" data-id="${task.id}" data-to="done" title="Mark done">✓</button>
      <div class="task-body">
        <div class="task-type">${escHtml(task.type)}</div>
        <div class="task-meta">
          ${task.lead_name ? `<a class="task-lead-link" data-url="${escAttr(task.linkedin_url || '')}">${escHtml(task.lead_name)}</a>` : ''}
          ${task.lead_company ? `<span>· ${escHtml(task.lead_company)}</span>` : ''}
          <span class="task-due ${dueClass}">${due}</span>
        </div>
      </div>
    </div>`;
}

function relativeDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dateStart - today) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  if (!s) return '';
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── API helper ──
async function fetchApi(sUrl, method, path, body, token) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) options.headers['Authorization'] = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${sUrl}/api${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}
