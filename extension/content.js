/**
 * Content Script — injected on LinkedIn profile pages.
 *
 * Flow:
 *   1. User opens a LinkedIn profile
 *   2. Sidebar appears, extracts profile data
 *   3. If lead doesn't exist → AUTO-CREATES it
 *   4. Shows lead stage + action buttons
 *   5. Clicking a button records an event and advances the stage
 *
 * All API calls go through background.js service worker.
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

    // ── Name: try h1, then page title, then og:title ──
    let fullName = '';

    // Strategy 1: h1 elements
    const allH1 = document.querySelectorAll('h1');
    for (const h1 of allH1) {
      const text = h1.textContent.trim();
      if (text && text.length > 1 && text.length < 80 && !text.includes('Outreach')) {
        fullName = text;
        break;
      }
    }

    // Strategy 2: page title  "Name - Title | LinkedIn"
    if (!fullName && document.title) {
      const m = document.title.match(/^(.+?)\s*[-–|]/);
      if (m && m[1].trim().length > 1) fullName = m[1].trim();
    }

    // Strategy 3: og:title meta
    if (!fullName) {
      const og = document.querySelector('meta[property="og:title"]');
      if (og && og.content) {
        const m = og.content.match(/^(.+?)\s*[-–|]/);
        fullName = m ? m[1].trim() : og.content.trim();
      }
    }

    // ── Headline ──
    let headline = '';
    for (const sel of ['div.text-body-medium', '[class*="text-body-medium"]']) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) { headline = el.textContent.trim(); break; }
    }
    if (!headline && document.title) {
      const parts = document.title.split(/\s*[-–]\s*/);
      if (parts.length >= 2) headline = parts[1].replace(/\s*\|\s*LinkedIn\s*$/, '').trim();
    }

    // ── Company ──
    let company = '';
    for (const sel of ['a[href*="/company/"] span', 'a[href*="/company/"]']) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
    }

    // ── Location ──
    let location = '';
    for (const sel of [
      'span.text-body-small.inline.t-black--light.break-words',
      '[class*="text-body-small"][class*="t-black--light"]',
    ]) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) { location = el.textContent.trim(); break; }
    }

    return { linkedin_url: profileUrl, name: fullName, title: headline, company, location };
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
        <button id="outreach-toggle" title="Collapse">◀</button>
      </div>
      <div id="outreach-content">
        <div id="outreach-loading" class="outreach-status-msg">⏳ Loading...</div>
        <div id="outreach-auth-required" style="display:none;">
          <p>⚙️ Log in via the extension icon first</p>
        </div>
        <div id="outreach-lead-info" style="display:none;">
          <div class="outreach-profile-name" id="outreach-lead-name"></div>
          <div class="outreach-section">
            <div class="outreach-label">STAGE</div>
            <div id="outreach-stage" class="outreach-value outreach-badge">—</div>
          </div>
          <div id="outreach-connection-hint" class="outreach-hint" style="display:none;">
            💡 "Message" button detected — might already be connected
          </div>
          <div class="outreach-section">
            <div class="outreach-label">TASKS</div>
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
        <div id="outreach-error" style="display:none;" class="outreach-status-msg"></div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Toggle sidebar
    document.getElementById('outreach-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.getElementById('outreach-toggle').textContent =
        sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // Action buttons
    document.querySelectorAll('.outreach-btn[data-event]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentLead) return;
        const eventType = btn.dataset.event;
        btn.disabled = true;
        btn.textContent = '⏳...';
        try {
          await api('POST', '/events', {
            lead_id: currentLead.id,
            type: eventType,
          });
          showNotification('Event recorded ✓', 'success');
          await loadLeadData();
        } catch (err) {
          showNotification('Error: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          resetButtonLabels();
        }
      });
    });
  }

  const BTN_LABELS = {
    invite_sent: '📩 Invite Sent',
    connected: '🤝 Connected',
    message_sent: '💬 Message Sent',
    reply_received: '📨 Reply Received',
    meeting_booked: '📅 Meeting Booked',
  };

  function resetButtonLabels() {
    document.querySelectorAll('.outreach-btn[data-event]').forEach((btn) => {
      btn.textContent = BTN_LABELS[btn.dataset.event];
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
        : 'background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7;'}
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ===========================
  // Data loading (auto-create if new)
  // ===========================
  async function loadLeadData() {
    const profile = extractProfileData();
    if (!profile.linkedin_url) return;

    showSection('outreach-loading');

    // Check if logged in
    const ready = await checkReady();
    if (!ready) {
      showSection('outreach-auth-required');
      return;
    }

    try {
      // 1. Try to find existing lead
      const result = await api('GET', `/leads/by-url?url=${encodeURIComponent(profile.linkedin_url)}`);

      if (result.lead) {
        currentLead = result.lead;
        currentTasks = result.tasks || [];
        renderLeadInfo();
        return;
      }

      // 2. Lead not found → AUTO-CREATE it
      if (!profile.name) {
        showError('Could not extract profile name. Try refreshing the page.');
        return;
      }

      const createResult = await api('POST', '/leads', profile);
      currentLead = createResult.lead;
      currentTasks = [];
      showNotification('Lead auto-created ✓', 'success');
      renderLeadInfo();

    } catch (err) {
      // If it's a duplicate error, try fetching again
      if (err.message.includes('already exists')) {
        try {
          const retry = await api('GET', `/leads/by-url?url=${encodeURIComponent(profile.linkedin_url)}`);
          if (retry.lead) {
            currentLead = retry.lead;
            currentTasks = retry.tasks || [];
            renderLeadInfo();
            return;
          }
        } catch (_) { /* ignore */ }
      }
      console.warn('[Outreach] Load error:', err.message);
      showError('Connection error. Check server.');
    }
  }

  // ===========================
  // Render lead info
  // ===========================
  function renderLeadInfo() {
    showSection('outreach-lead-info');

    const nameEl = document.getElementById('outreach-lead-name');
    if (nameEl) nameEl.textContent = currentLead.name;

    document.getElementById('outreach-stage').textContent = currentLead.stage;
    document.getElementById('outreach-stage').className =
      `outreach-value outreach-badge stage-${currentLead.stage.toLowerCase()}`;

    // Connection hint
    const hasMessageBtn = [...document.querySelectorAll('button')].some(
      b => b.textContent.trim().toLowerCase() === 'message'
    );
    const hint = document.getElementById('outreach-connection-hint');
    hint.style.display = (hasMessageBtn && currentLead.stage === 'Invited') ? 'block' : 'none';

    // Tasks
    const tasksContainer = document.getElementById('outreach-tasks');
    if (currentTasks.length === 0) {
      tasksContainer.innerHTML = '<div class="outreach-no-tasks">No tasks</div>';
    } else {
      tasksContainer.innerHTML = currentTasks
        .map((t) => {
          const overdue = t.status === 'open' && new Date(t.due_at) < new Date();
          return `
            <div class="outreach-task ${overdue ? 'overdue' : ''} ${t.status}">
              <span class="task-type">${t.type}</span>
              <span class="task-due">${new Date(t.due_at).toLocaleDateString()}</span>
              <span class="task-status">${t.status === 'done' ? '✅' : overdue ? '⚠️' : '🔵'}</span>
            </div>`;
        })
        .join('');
    }

    // Highlight current stage button
    highlightCurrentStage();
  }

  // Dim buttons for stages that are already passed
  function highlightCurrentStage() {
    const stageOrder = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
    const eventForStage = {
      'Invited': 'invite_sent',
      'Connected': 'connected',
      'Messaged': 'message_sent',
      'Replied': 'reply_received',
      'Meeting': 'meeting_booked',
    };

    const currentIdx = stageOrder.indexOf(currentLead.stage);

    document.querySelectorAll('.outreach-btn[data-event]').forEach((btn) => {
      const eventType = btn.dataset.event;
      // Find which stage this button leads to
      const targetStage = Object.entries(eventForStage).find(([_, ev]) => ev === eventType);
      if (targetStage) {
        const targetIdx = stageOrder.indexOf(targetStage[0]);
        if (targetIdx <= currentIdx) {
          btn.style.opacity = '0.4';
          btn.style.pointerEvents = 'none';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      }
    });
  }

  // ===========================
  // Section visibility helpers
  // ===========================
  function showSection(id) {
    ['outreach-loading', 'outreach-lead-info', 'outreach-auth-required', 'outreach-error']
      .forEach(sId => {
        const el = document.getElementById(sId);
        if (el) el.style.display = sId === id ? 'block' : 'none';
      });
  }

  function showError(msg) {
    showSection('outreach-error');
    const el = document.getElementById('outreach-error');
    if (el) el.textContent = '⚠️ ' + msg;
  }

  // ===========================
  // SPA navigation detection
  // LinkedIn is a SPA — URL changes without full page reload.
  // We watch for URL changes and re-load lead data.
  // ===========================
  let lastUrl = window.location.href;

  function watchNavigation() {
    const check = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // Only act on profile pages
        if (currentUrl.includes('linkedin.com/in/')) {
          currentLead = null;
          currentTasks = [];
          // Wait for new page content to load
          setTimeout(loadLeadData, 2000);
        }
      }
    };
    setInterval(check, 1000);
  }

  // ===========================
  // Initialize
  // ===========================
  function init() {
    createSidebar();
    // Wait for LinkedIn to fully render profile content
    setTimeout(loadLeadData, 2000);
    watchNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
