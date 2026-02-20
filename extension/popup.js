/**
 * Popup script — server setup + login + status.
 *
 * Flow:
 *  1) If no serverUrl saved → show setup
 *  2) If serverUrl but no token → show login
 *  3) If token → show logged-in state
 */

// -------------------------
// DOM refs
// -------------------------
const setupSection = document.getElementById('setup-section');
const loginSection = document.getElementById('login-section');
const userSection = document.getElementById('user-section');

const serverUrlInput = document.getElementById('server-url');
const testBtn = document.getElementById('test-btn');
const saveServerBtn = document.getElementById('save-server-btn');
const setupError = document.getElementById('setup-error');
const connectionStatus = document.getElementById('connection-status');

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

const gearBtn = document.getElementById('gear-btn');

// -------------------------
// Init: determine which screen to show
// -------------------------
chrome.storage.local.get(['serverUrl', 'token'], async (data) => {
  if (!data.serverUrl) {
    showSetup();
    return;
  }

  if (!data.token) {
    showLogin(data.serverUrl);
    return;
  }

  // Has token → verify it
  try {
    const res = await fetchApi(data.serverUrl, 'GET', '/auth/me', null, data.token);
    showLoggedIn(data.serverUrl, res.employee);
  } catch {
    // Token expired / invalid → show login
    showLogin(data.serverUrl);
  }
});

// -------------------------
// Gear button → open settings
// -------------------------
gearBtn.addEventListener('click', () => {
  chrome.storage.local.get('serverUrl', (data) => {
    showSetup(data.serverUrl);
  });
});

// -------------------------
// SETUP: Test connection
// -------------------------
testBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, '');
  setupError.textContent = '';
  connectionStatus.innerHTML = '';

  if (!url) {
    setupError.textContent = 'Введите адрес сервера';
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = '⏳ Проверяю...';

  try {
    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();

    if (json.status === 'ok') {
      connectionStatus.innerHTML = `
        <div class="status-bar status-ok">
          <span class="dot dot-green"></span>
          Подключение установлено ✓
        </div>`;
    } else {
      throw new Error('Unexpected response');
    }
  } catch (err) {
    connectionStatus.innerHTML = `
      <div class="status-bar status-err">
        <span class="dot dot-red"></span>
        Не удалось подключиться. Проверьте адрес и фаервол.
      </div>`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '🔌 Проверить подключение';
  }
});

// -------------------------
// SETUP: Save server URL
// -------------------------
saveServerBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, '');
  setupError.textContent = '';

  if (!url) {
    setupError.textContent = 'Введите адрес сервера';
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    setupError.textContent = 'Неверный формат URL. Пример: http://192.168.1.10:3001';
    return;
  }

  chrome.storage.local.set({ serverUrl: url }, () => {
    showLogin(url);
  });
});

// -------------------------
// LOGIN
// -------------------------
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  loginError.textContent = '';

  if (!email || !password) {
    loginError.textContent = 'Заполните все поля';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = '⏳...';

  try {
    const data = await chrome.storage.local.get('serverUrl');
    const serverUrl = data.serverUrl;
    const res = await fetchApi(serverUrl, 'POST', '/auth/login', { email, password });
    chrome.storage.local.set({ token: res.token }, () => {
      showLoggedIn(serverUrl, res.employee);
    });
  } catch (err) {
    loginError.textContent = err.message || 'Ошибка входа';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Войти';
  }
});

// -------------------------
// LOGOUT
// -------------------------
logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove('token', () => {
    chrome.storage.local.get('serverUrl', (data) => {
      showLogin(data.serverUrl);
    });
  });
});

// -------------------------
// Screen switches
// -------------------------
function hideAll() {
  setupSection.style.display = 'none';
  loginSection.style.display = 'none';
  userSection.style.display = 'none';
}

function showSetup(currentUrl) {
  hideAll();
  setupSection.style.display = 'block';
  serverUrlInput.value = currentUrl || '';
  connectionStatus.innerHTML = '';
  setupError.textContent = '';
}

function showLogin(serverUrl) {
  hideAll();
  loginSection.style.display = 'block';
  document.getElementById('current-server-display').textContent = `🖥️ ${serverUrl}`;
  loginError.textContent = '';
}

function showLoggedIn(serverUrl, employee) {
  hideAll();
  userSection.style.display = 'block';
  document.getElementById('user-name').textContent = employee.name;
  document.getElementById('user-role').textContent = employee.role;
  document.getElementById('server-status').innerHTML = `
    <div class="status-bar status-ok">
      <span class="dot dot-green"></span>
      ${serverUrl}
    </div>`;
}

// -------------------------
// API helper
// -------------------------
async function fetchApi(serverUrl, method, path, body, token) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) options.headers['Authorization'] = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${serverUrl}/api${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}
