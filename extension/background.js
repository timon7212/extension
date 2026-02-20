/**
 * Background service worker (Manifest V3)
 *
 * Responsibilities:
 * - Store auth token & server URL
 * - Proxy API requests from content script
 * - Server URL is configurable (not hardcoded)
 */

const DEFAULT_SERVER = 'http://localhost:3001';

// -------------------------
// Helpers
// -------------------------
async function getServerUrl() {
  const data = await chrome.storage.local.get('serverUrl');
  return (data.serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
}

async function getToken() {
  const data = await chrome.storage.local.get('token');
  return data.token || null;
}

// -------------------------
// Message handler
// -------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'apiRequest') {
    handleApiRequest(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'setToken') {
    chrome.storage.local.set({ token: message.token }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === 'getToken') {
    getToken().then((token) => sendResponse({ token }));
    return true;
  }

  if (message.action === 'logout') {
    chrome.storage.local.remove('token', () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === 'setServerUrl') {
    const url = (message.url || '').replace(/\/+$/, '');
    chrome.storage.local.set({ serverUrl: url }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === 'getServerUrl') {
    getServerUrl().then((url) => sendResponse({ serverUrl: url }));
    return true;
  }

  if (message.action === 'testConnection') {
    testConnection()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/**
 * Test connection to server.
 */
async function testConnection() {
  const serverUrl = await getServerUrl();
  const response = await fetch(`${serverUrl}/api/health`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }

  return await response.json();
}

/**
 * Make authenticated API request.
 */
async function handleApiRequest({ method, path, body }) {
  const serverUrl = await getServerUrl();
  const token = await getToken();

  const options = {
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${serverUrl}/api${path}`, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || 'API request failed');
  }

  return json;
}
