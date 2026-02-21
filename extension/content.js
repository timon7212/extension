/**
 * Content Script — injected on LinkedIn profile pages.
 *
 * Responsibilities:
 * 1. Extract profile data from the page
 * 2. Detect UI state (Connect vs Message button)
 * 3. Render sidebar
 * 4. Handle action buttons
 *
 * All API calls go through background.js (which reads server URL from storage).
 */

(function () {
  'use strict';

  // Prevent double injection
  if (document.getElementById('outreach-sidebar')) return;

  // ===========================
  // Profile data extraction
  // ===========================
  function extractProfileData() {
    const profileUrl = window.location.href.split('?')[0].replace(/\/$/, '');

    // ── Name extraction (multiple strategies) ──
    let fullName = '';

    // Strategy 1: Query all h1 elements and find the one most likely to be a person name
    const allH1 = document.querySelectorAll('h1');
    for (const h1 of allH1) {
      const text = h1.textContent.trim();
      // Skip our own sidebar header or very short/long texts
      if (text && text.length > 1 && text.length < 80 && !text.includes('Outreach')) {
        fullName = text;
        break;
      }
    }

    // Strategy 2: LinkedIn page title is usually "Firstname Lastname - Title | LinkedIn"
    if (!fullName && document.title) {
      const titleMatch = document.title.match(/^(.+?)\s*[-–|]/);
      if (titleMatch && titleMatch[1].trim().length > 1) {
        fullName = titleMatch[1].trim();
      }
    }

    // Strategy 3: og:title meta tag
    if (!fullName) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        const ogMatch = ogTitle.content.match(/^(.+?)\s*[-–|]/);
        fullName = ogMatch ? ogMatch[1].trim() : ogTitle.content.trim();
      }
    }

    // ── Headline / Title ──
    let headline = '';
    // Try multiple selectors
    const headlineSelectors = [
      'div.text-body-medium',
      '[class*="text-body-medium"]',
      'main section .text-body-medium',
    ];
    for (const sel of headlineSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        headline = el.textContent.trim();
        break;
      }
    }
    // Fallback: parse from page title "Name - Headline | LinkedIn"
    if (!headline && document.title) {
      const parts = document.title.split(/\s*[-–]\s*/);
      if (parts.length >= 2) {
        headline = parts[1].replace(/\s*\|\s*LinkedIn\s*$/, '').trim();
      }
    }

    // ── Company ──
    let company = '';
    const companySelectors = [
      'div.pv-text-details__right-panel .inline-show-more-text',
      'a[href*="/company/"] span',
      'a[href*="/company/"]',
    ];
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        company = el.textContent.trim();
        break;
      }
    }

    // ── Location ──
    let location = '';
    const locationSelectors = [
      'span.text-body-small.inline.t-black--light.break-words',
      '[class*="text-body-small"][class*="t-black--light"]',
      'main section span.text-body-small',
    ];
    for (const sel of locationSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        location = el.textContent.trim();
        break;
      }
    }

    console.log('[Outreach] === Profile extraction ===');
    console.log('[Outreach] URL:', profileUrl);
    console.log('[Outreach] Name:', fullName || '(EMPTY!)');
    console.log('[Outreach] Title:', headline);
    console.log('[Outreach] Company:', company);
    console.log('[Outreach] Location:', location);
    console.log('[Outreach] Page title:', document.title);
    console.log('[Outreach] All h1 on page:', [...document.querySelectorAll('h1')].map(e => e.textContent.trim()));

    return {
      linkedin_url: profileUrl,
      name: fullName,
      title: headline,
      company,
      location,
    };
  }

  // ===========================
  // Detect UI state
  // ===========================
  function detectConnectionState() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'message') {
        return 'likely_connected';
      }
    }
    return 'not_connected';
  }

  // ===========================
  // API helper (via background service worker)
  // ===========================
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'apiRequest', method, path, body },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Check if the extension is configured (server URL + token present).
   */
  function checkReady() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getToken' }, (res) => {
        resolve(!!(res && res.token));
      });
    });
  }

  // ===========================
  // Sidebar UI
  // ===========================
  let currentLead = null;
  let currentTasks = [];

  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'outreach-sidebar';

    sidebar.innerHTML = `
      <div class="outreach-sidebar-header">
        <span class="outreach-logo">📋 Outreach</span>
        <button id="outreach-toggle" title="Свернуть">◀</button>
      </div>
      <div id="outreach-content">
        <div id="outreach-loading">Загрузка...</div>
        <div id="outreach-auth-required" style="display:none;">
          <p>⚙️ Настройте сервер и войдите через иконку расширения</p>
        </div>
        <div id="outreach-lead-info" style="display:none;">
          <div class="outreach-section">
            <div class="outreach-label">Стадия</div>
            <div id="outreach-stage" class="outreach-value outreach-badge">—</div>
          </div>
          <div class="outreach-section">
            <div class="outreach-label">Владелец</div>
            <div id="outreach-owner" class="outreach-value">—</div>
          </div>
          <div id="outreach-connection-hint" class="outreach-hint" style="display:none;">
            💡 Кнопка "Message" обнаружена — возможно, уже подключены?
          </div>
          <div class="outreach-section">
            <div class="outreach-label">Задачи</div>
            <div id="outreach-tasks" class="outreach-tasks-list"></div>
          </div>
          <div class="outreach-actions">
            <button class="outreach-btn outreach-btn-invite" data-event="invite_sent">
              📩 Invite Sent
            </button>
            <button class="outreach-btn outreach-btn-connected" data-event="connected">
              🤝 Connected
            </button>
            <button class="outreach-btn outreach-btn-message" data-event="message_sent">
              💬 Message Sent
            </button>
            <button class="outreach-btn outreach-btn-reply" data-event="reply_received">
              📨 Reply Received
            </button>
            <button class="outreach-btn outreach-btn-meeting" data-event="meeting_booked">
              📅 Meeting Booked
            </button>
          </div>
        </div>
        <div id="outreach-new-lead" style="display:none;">
          <p>Лид не найден в системе.</p>
          <button id="outreach-create-lead" class="outreach-btn outreach-btn-create">
            ➕ Создать лид
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    attachEventListeners();
  }

  function attachEventListeners() {
    // Toggle sidebar
    document.getElementById('outreach-toggle').addEventListener('click', () => {
      const sidebar = document.getElementById('outreach-sidebar');
      sidebar.classList.toggle('collapsed');
      document.getElementById('outreach-toggle').textContent =
        sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // Action buttons
    document.querySelectorAll('.outreach-btn[data-event]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentLead) return;
        const eventType = btn.dataset.event;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳...';
        try {
          await api('POST', '/events', {
            lead_id: currentLead.id,
            type: eventType,
          });
          await loadLeadData();
        } catch (err) {
          showNotification('Ошибка: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          resetButtonLabels();
        }
      });
    });

    // Create lead button
    document.getElementById('outreach-create-lead').addEventListener('click', async () => {
      const profile = extractProfileData();
      const btn = document.getElementById('outreach-create-lead');
      btn.disabled = true;
      btn.textContent = '⏳ Создаю...';
      try {
        const result = await api('POST', '/leads', profile);
        currentLead = result.lead;
        showNotification('Лид создан ✓', 'success');
        renderLeadInfo();
      } catch (err) {
        showNotification('Ошибка: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '➕ Создать лид';
      }
    });
  }

  function resetButtonLabels() {
    const labels = {
      invite_sent: '📩 Invite Sent',
      connected: '🤝 Connected',
      message_sent: '💬 Message Sent',
      reply_received: '📨 Reply Received',
      meeting_booked: '📅 Meeting Booked',
    };
    document.querySelectorAll('.outreach-btn[data-event]').forEach((btn) => {
      btn.textContent = labels[btn.dataset.event];
    });
  }

  // ===========================
  // Notification toast
  // ===========================
  function showNotification(text, type) {
    const existing = document.getElementById('outreach-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'outreach-toast';
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 340px; z-index: 100000;
      padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      ${type === 'error'
        ? 'background: #ffebee; color: #c62828; border: 1px solid #ef9a9a;'
        : 'background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7;'
      }
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ===========================
  // Data loading & rendering
  // ===========================
  async function loadLeadData() {
    const profile = extractProfileData();
    if (!profile.linkedin_url) return;

    show('outreach-loading');
    hide('outreach-lead-info');
    hide('outreach-new-lead');
    hide('outreach-auth-required');

    // Check if logged in first
    const ready = await checkReady();
    if (!ready) {
      hide('outreach-loading');
      show('outreach-auth-required');
      return;
    }

    try {
      const result = await api('GET', `/leads/by-url?url=${encodeURIComponent(profile.linkedin_url)}`);

      if (result.lead) {
        currentLead = result.lead;
        currentTasks = result.tasks || [];
        renderLeadInfo();
      } else {
        hide('outreach-loading');
        show('outreach-new-lead');
      }
    } catch (err) {
      hide('outreach-loading');
      show('outreach-auth-required');
    }
  }

  function renderLeadInfo() {
    hide('outreach-loading');
    hide('outreach-new-lead');
    hide('outreach-auth-required');
    show('outreach-lead-info');

    document.getElementById('outreach-stage').textContent = currentLead.stage;
    document.getElementById('outreach-stage').className = `outreach-value outreach-badge stage-${currentLead.stage.toLowerCase()}`;
    document.getElementById('outreach-owner').textContent = currentLead.owner_name || '—';

    // Connection hint
    const connState = detectConnectionState();
    const hint = document.getElementById('outreach-connection-hint');
    if (connState === 'likely_connected' && currentLead.stage === 'Invited') {
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }

    // Tasks
    const tasksContainer = document.getElementById('outreach-tasks');
    if (currentTasks.length === 0) {
      tasksContainer.innerHTML = '<div class="outreach-no-tasks">Нет задач</div>';
    } else {
      tasksContainer.innerHTML = currentTasks
        .map((t) => {
          const overdue = t.status === 'open' && new Date(t.due_at) < new Date();
          return `
            <div class="outreach-task ${overdue ? 'overdue' : ''} ${t.status}">
              <span class="task-type">${t.type}</span>
              <span class="task-due">${new Date(t.due_at).toLocaleDateString()}</span>
              <span class="task-status">${t.status === 'done' ? '✅' : overdue ? '⚠️' : '🔵'}</span>
            </div>
          `;
        })
        .join('');
    }
  }

  // ===========================
  // Helpers
  // ===========================
  function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }

  function hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // ===========================
  // Initialize
  // ===========================
  function init() {
    createSidebar();
    setTimeout(loadLeadData, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
