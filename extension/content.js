/**
 * Content Script — injected on LinkedIn profile pages.
 *
 * As a CPO-level experience:
 *   1. Auto-creates lead on profile visit
 *   2. Shows current stage in a pipeline visualizer
 *   3. Quick-select task presets + custom tasks
 *   4. One-click stage transitions
 *   5. Toggle task completion right from sidebar
 *
 * All API calls go through background.js service worker.
 */

(function () {
  'use strict';

  if (document.getElementById('outreach-sidebar')) return;

  // ───────────────────────────
  // Quick task presets (CPO: most common outreach tasks)
  // ───────────────────────────
  const TASK_PRESETS = [
    { emoji: '📞', label: 'Follow up' },
    { emoji: '💬', label: 'Send message' },
    { emoji: '📅', label: 'Schedule call' },
    { emoji: '📝', label: 'Research' },
    { emoji: '🔔', label: 'Check reply' },
  ];

  // ───────────────────────────
  // Profile data extraction
  // ───────────────────────────
  function extractProfileData() {
    const profileUrl = window.location.href.split('?')[0].replace(/\/$/, '');

    let fullName = '';
    const allH1 = document.querySelectorAll('h1');
    for (const h1 of allH1) {
      const text = h1.textContent.trim();
      if (text && text.length > 1 && text.length < 80 && !text.includes('Outreach')) {
        fullName = text;
        break;
      }
    }
    if (!fullName && document.title) {
      const m = document.title.match(/^(.+?)\s*[-–|]/);
      if (m && m[1].trim().length > 1) fullName = m[1].trim();
    }
    if (!fullName) {
      const og = document.querySelector('meta[property="og:title"]');
      if (og && og.content) {
        const m = og.content.match(/^(.+?)\s*[-–|]/);
        fullName = m ? m[1].trim() : og.content.trim();
      }
    }

    let headline = '';
    for (const sel of ['div.text-body-medium', '[class*="text-body-medium"]']) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) { headline = el.textContent.trim(); break; }
    }
    if (!headline && document.title) {
      const parts = document.title.split(/\s*[-–]\s*/);
      if (parts.length >= 2) headline = parts[1].replace(/\s*\|\s*LinkedIn\s*$/, '').trim();
    }

    let company = '';
    for (const sel of ['a[href*="/company/"] span', 'a[href*="/company/"]']) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) { company = el.textContent.trim(); break; }
    }

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

  // ───────────────────────────
  // API helper
  // ───────────────────────────
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'apiRequest', method, path, body },
        (response) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (response && response.error) return reject(new Error(response.error));
          resolve(response);
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

  // ───────────────────────────
  // State
  // ───────────────────────────
  let currentLead = null;
  let currentTasks = [];

  const STAGES = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const EVENT_FOR_STAGE = {
    Invited: 'invite_sent',
    Connected: 'connected',
    Messaged: 'message_sent',
    Replied: 'reply_received',
    Meeting: 'meeting_booked',
  };

  // ───────────────────────────
  // Create Sidebar
  // ───────────────────────────
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'outreach-sidebar';

    // Build task preset chips HTML
    const presetsHtml = TASK_PRESETS
      .map(p => `<button class="outreach-preset-chip" data-label="${p.label}">${p.emoji} ${p.label}</button>`)
      .join('');

    sidebar.innerHTML = `
      <div class="outreach-sidebar-header">
        <span class="outreach-logo">📋 Outreach</span>
        <button id="outreach-toggle" title="Collapse">◀</button>
      </div>
      <div id="outreach-content">
        <!-- Loading -->
        <div id="outreach-loading" class="outreach-center-msg">
          <div class="outreach-spinner"></div>
          <p>Loading...</p>
        </div>

        <!-- Auth required -->
        <div id="outreach-auth-required" style="display:none;" class="outreach-center-msg">
          <div style="font-size:32px; margin-bottom:8px;">🔒</div>
          <p>Log in via the extension popup first</p>
        </div>

        <!-- Lead Info -->
        <div id="outreach-lead-info" style="display:none;">
          <!-- Name + company -->
          <div class="outreach-profile-card">
            <div class="outreach-profile-name" id="outreach-lead-name"></div>
            <div class="outreach-profile-subtitle" id="outreach-lead-subtitle"></div>
          </div>

          <!-- Pipeline mini-visualizer -->
          <div class="outreach-pipeline" id="outreach-pipeline"></div>

          <!-- Tasks -->
          <div class="outreach-section">
            <div class="outreach-section-header">
              <span class="outreach-label">📋 Tasks</span>
              <span class="outreach-task-count" id="outreach-task-count">0</span>
            </div>
            <div id="outreach-tasks" class="outreach-tasks-list"></div>

            <!-- Quick task presets -->
            <div class="outreach-presets">${presetsHtml}</div>

            <!-- Custom task form -->
            <div class="outreach-add-task-form">
              <div class="outreach-add-task-row">
                <input type="text" id="outreach-task-type" placeholder="Custom task..." class="outreach-task-input" />
                <input type="date" id="outreach-task-due" class="outreach-task-date" />
                <button id="outreach-add-task-btn" class="outreach-btn-add" title="Add task">+</button>
              </div>
            </div>
          </div>

          <!-- Stage Actions -->
          <div class="outreach-section">
            <div class="outreach-label">⚡ Actions</div>
            <div class="outreach-actions" id="outreach-actions"></div>
          </div>
        </div>

        <!-- Error -->
        <div id="outreach-error" style="display:none;" class="outreach-center-msg"></div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Toggle
    document.getElementById('outreach-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.getElementById('outreach-toggle').textContent =
        sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // Add Task button
    document.getElementById('outreach-add-task-btn').addEventListener('click', handleAddTask);
    document.getElementById('outreach-task-type').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddTask();
    });

    // Preset chips
    document.querySelectorAll('.outreach-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.getElementById('outreach-task-type').value = chip.dataset.label;
        handleAddTask();
      });
    });

    // Default due date → tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('outreach-task-due').value = tomorrow.toISOString().split('T')[0];
  }

  // ───────────────────────────
  // Add Task
  // ───────────────────────────
  async function handleAddTask() {
    if (!currentLead) return;
    const typeInput = document.getElementById('outreach-task-type');
    const dueInput = document.getElementById('outreach-task-due');
    const addBtn = document.getElementById('outreach-add-task-btn');

    const taskType = typeInput.value.trim();
    if (!taskType) {
      typeInput.focus();
      typeInput.classList.add('shake');
      setTimeout(() => typeInput.classList.remove('shake'), 500);
      return;
    }

    addBtn.disabled = true;
    addBtn.textContent = '⏳';

    try {
      const body = { lead_id: currentLead.id, type: taskType };
      if (dueInput.value) body.due_at = new Date(dueInput.value + 'T12:00:00').toISOString();

      await api('POST', '/tasks', body);
      typeInput.value = '';
      showToast('Task added ✓');

      await reloadTasks();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = '+';
    }
  }

  async function toggleTaskStatus(taskId, newStatus) {
    try {
      await api('PATCH', `/tasks/${taskId}`, { status: newStatus });
      showToast(newStatus === 'done' ? 'Done ✓' : 'Reopened');
      await reloadTasks();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function reloadTasks() {
    if (!currentLead) return;
    try {
      const r = await api('GET', `/leads/by-url?url=${encodeURIComponent(currentLead.linkedin_url)}`);
      if (r.lead) {
        currentTasks = r.tasks || [];
        renderTasksList();
      }
    } catch (_) { /* silent */ }
  }

  // ───────────────────────────
  // Toast notification
  // ───────────────────────────
  function showToast(text, type = 'success') {
    let toast = document.getElementById('outreach-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'outreach-toast';
    toast.className = `outreach-toast ${type === 'error' ? 'outreach-toast-error' : 'outreach-toast-success'}`;
    toast.textContent = text;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ───────────────────────────
  // Load lead data
  // ───────────────────────────
  async function loadLeadData() {
    const profile = extractProfileData();
    if (!profile.linkedin_url) return;

    showSection('outreach-loading');

    const ready = await checkReady();
    if (!ready) { showSection('outreach-auth-required'); return; }

    try {
      const result = await api('GET', `/leads/by-url?url=${encodeURIComponent(profile.linkedin_url)}`);
      if (result.lead) {
        currentLead = result.lead;
        currentTasks = result.tasks || [];
        renderLeadInfo();
        return;
      }

      if (!profile.name) {
        showError('Could not extract profile name. Refresh the page.');
        return;
      }

      const createResult = await api('POST', '/leads', profile);
      currentLead = createResult.lead;
      currentTasks = [];
      showToast('Lead auto-created ✓');
      renderLeadInfo();
    } catch (err) {
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
      showError('Connection error. Is the server running?');
    }
  }

  // ───────────────────────────
  // Render
  // ───────────────────────────
  function renderLeadInfo() {
    showSection('outreach-lead-info');

    document.getElementById('outreach-lead-name').textContent = currentLead.name;
    document.getElementById('outreach-lead-subtitle').textContent =
      [currentLead.title, currentLead.company].filter(Boolean).join(' · ') || '';

    renderPipeline();
    renderTasksList();
    renderActionButtons();
  }

  function renderPipeline() {
    const container = document.getElementById('outreach-pipeline');
    const currentIdx = STAGES.indexOf(currentLead.stage);

    container.innerHTML = STAGES.map((stage, idx) => {
      let cls = 'outreach-pipe-step';
      if (idx < currentIdx) cls += ' passed';
      if (idx === currentIdx) cls += ' active';
      return `<div class="${cls}"><span class="pipe-dot"></span><span class="pipe-label">${stage}</span></div>`;
    }).join('<div class="outreach-pipe-line"></div>');
  }

  function renderTasksList() {
    const container = document.getElementById('outreach-tasks');
    const countEl = document.getElementById('outreach-task-count');
    const openCount = currentTasks.filter(t => t.status === 'open').length;
    countEl.textContent = openCount;

    if (currentTasks.length === 0) {
      container.innerHTML = '<div class="outreach-empty">No tasks yet — add one below</div>';
      return;
    }

    // Sort: open first (overdue at top), done at bottom
    const sorted = [...currentTasks].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      const aOverdue = a.status === 'open' && new Date(a.due_at) < new Date();
      const bOverdue = b.status === 'open' && new Date(b.due_at) < new Date();
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return new Date(a.due_at) - new Date(b.due_at);
    });

    container.innerHTML = sorted.map((t) => {
      const overdue = t.status === 'open' && new Date(t.due_at) < new Date();
      const isDone = t.status === 'done';
      const icon = isDone ? '✅' : overdue ? '🔴' : '⬜';
      const dueDateStr = new Date(t.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return `
        <div class="outreach-task ${overdue ? 'overdue' : ''} ${isDone ? 'done' : ''}">
          <button class="task-toggle" data-task-id="${t.id}" data-new-status="${isDone ? 'open' : 'done'}">${icon}</button>
          <span class="task-text ${isDone ? 'strikethrough' : ''}">${t.type}</span>
          <span class="task-date ${overdue ? 'text-red' : ''}">${dueDateStr}</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.task-toggle').forEach((btn) => {
      btn.addEventListener('click', () => toggleTaskStatus(btn.dataset.taskId, btn.dataset.newStatus));
    });
  }

  function renderActionButtons() {
    const container = document.getElementById('outreach-actions');
    const currentIdx = STAGES.indexOf(currentLead.stage);

    const BTN_CONFIG = [
      { event: 'invite_sent', emoji: '📩', label: 'Invite Sent', cls: 'invite' },
      { event: 'connected', emoji: '🤝', label: 'Connected', cls: 'connected' },
      { event: 'message_sent', emoji: '💬', label: 'Message Sent', cls: 'message' },
      { event: 'reply_received', emoji: '📨', label: 'Reply Received', cls: 'reply' },
      { event: 'meeting_booked', emoji: '📅', label: 'Meeting Booked', cls: 'meeting' },
    ];

    container.innerHTML = BTN_CONFIG.map((cfg) => {
      const targetStage = Object.entries(EVENT_FOR_STAGE).find(([_, ev]) => ev === cfg.event);
      const targetIdx = targetStage ? STAGES.indexOf(targetStage[0]) : -1;
      const isPassed = targetIdx <= currentIdx;
      const isNext = targetIdx === currentIdx + 1;

      return `
        <button class="outreach-action-btn outreach-btn-${cfg.cls} ${isPassed ? 'passed' : ''} ${isNext ? 'next-action' : ''}"
                data-event="${cfg.event}" ${isPassed ? 'disabled' : ''}>
          ${cfg.emoji} ${cfg.label}
          ${isPassed ? '<span class="check-mark">✓</span>' : ''}
          ${isNext ? '<span class="next-badge">NEXT</span>' : ''}
        </button>`;
    }).join('');

    container.querySelectorAll('.outreach-action-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const eventType = btn.dataset.event;
        btn.disabled = true;
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<span class="outreach-spinner-small"></span> Recording...';
        try {
          await api('POST', '/events', { lead_id: currentLead.id, type: eventType });
          showToast('Stage updated ✓');
          await loadLeadData();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  // ───────────────────────────
  // Section visibility
  // ───────────────────────────
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
    if (el) el.innerHTML = `<div style="font-size:28px;margin-bottom:8px;">⚠️</div><p>${msg}</p>`;
  }

  // ───────────────────────────
  // SPA navigation
  // ───────────────────────────
  let lastUrl = window.location.href;

  function watchNavigation() {
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (currentUrl.includes('linkedin.com/in/')) {
          currentLead = null;
          currentTasks = [];
          setTimeout(loadLeadData, 2000);
        }
      }
    }, 1000);
  }

  // ───────────────────────────
  // Init
  // ───────────────────────────
  function init() {
    createSidebar();
    setTimeout(loadLeadData, 2000);
    watchNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
