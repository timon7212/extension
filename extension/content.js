/**
 * Content Script — Profile Sidebar (LinkedIn /in/* pages)
 *
 * CPO/CTO Flow:
 *   1. Auto-create lead on first profile visit
 *   2. Auto-UPDATE lead data on every subsequent visit (title, company, location)
 *      → "double-check" mechanism: each visit refreshes stale data
 *   3. Pipeline mini-visualizer
 *   4. Rich task management: grouped by urgency, relative dates, delete, presets
 *   5. Smart stage transitions with "NEXT" hints
 */

(function () {
  'use strict';

  if (document.getElementById('outreach-sidebar')) return;

  // ───────────────────────────
  // Task presets — one-tap creation
  // ───────────────────────────
  const TASK_PRESETS = [
    { emoji: '📞', label: 'Follow up' },
    { emoji: '💬', label: 'Send message' },
    { emoji: '📅', label: 'Schedule call' },
    { emoji: '📝', label: 'Research' },
    { emoji: '🔔', label: 'Check reply' },
    { emoji: '🎯', label: 'Pitch' },
  ];

  const STAGES = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];
  const EVENT_FOR_STAGE = {
    Invited: 'invite_sent',
    Connected: 'connected',
    Messaged: 'message_sent',
    Replied: 'reply_received',
    Meeting: 'meeting_booked',
  };

  // ───────────────────────────
  // Profile data extraction
  // ───────────────────────────
  function extractProfileData() {
    const profileUrl = window.location.href.split('?')[0].replace(/\/$/, '');

    // Name
    let fullName = '';
    const allH1 = document.querySelectorAll('h1');
    for (const h1 of allH1) {
      const text = h1.textContent.trim();
      if (text && text.length > 1 && text.length < 80 && !text.includes('Outreach')) {
        fullName = text; break;
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

    // Headline — filter out junk like "Follow"
    let headline = '';
    for (const sel of ['div.text-body-medium', '[class*="text-body-medium"]']) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text && text.length > 1 && !/^(follow|message|connect|pending)$/i.test(text)) {
          headline = text;
          break;
        }
      }
    }
    if (!headline && document.title) {
      const parts = document.title.split(/\s*[-–]\s*/);
      if (parts.length >= 2) headline = parts[1].replace(/\s*\|\s*LinkedIn\s*$/, '').trim();
    }

    // Company — filter out action words like "Follow", "Message", etc.
    const JUNK_WORDS = /^(follow|message|connect|pending|subscribe|more|report|block)$/i;
    let company = '';
    const companyLinks = document.querySelectorAll('a[href*="/company/"]');
    for (const link of companyLinks) {
      // Try span inside the link first, then the link text itself
      const candidates = [link.querySelector('span'), link];
      for (const el of candidates) {
        if (!el) continue;
        const text = el.textContent.trim();
        if (text && text.length > 1 && text.length < 100 && !JUNK_WORDS.test(text)) {
          company = text;
          break;
        }
      }
      if (company) break;
    }

    // Location
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
  // API / Auth
  // ───────────────────────────
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'apiRequest', method, path, body },
        (r) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (r && r.error) return reject(new Error(r.error));
          resolve(r);
        }
      );
    });
  }

  function checkReady() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getToken' }, (r) => resolve(!!(r && r.token)));
    });
  }

  // ───────────────────────────
  // State
  // ───────────────────────────
  let currentLead = null;
  let currentTasks = [];
  let currentEvents = [];

  const EVENT_LABELS = {
    invite_sent: { icon: '📩', label: 'Invite Sent' },
    connected: { icon: '🤝', label: 'Connected' },
    message_sent: { icon: '💬', label: 'Message Sent' },
    reply_received: { icon: '📨', label: 'Reply Received' },
    meeting_booked: { icon: '📅', label: 'Meeting Booked' },
  };

  // ───────────────────────────
  // Date helpers
  // ───────────────────────────
  function relativeDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfDate - startOfToday) / 86400000);

    if (diffDays === 0) return { label: 'Today', cls: 'date-today' };
    if (diffDays === 1) return { label: 'Tomorrow', cls: 'date-tomorrow' };
    if (diffDays === -1) return { label: 'Yesterday', cls: 'date-overdue' };
    if (diffDays < -1) return { label: `${Math.abs(diffDays)}d overdue`, cls: 'date-overdue' };
    if (diffDays <= 7) return { label: `In ${diffDays}d`, cls: 'date-upcoming' };
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'date-future' };
  }

  // ───────────────────────────
  // Create Sidebar
  // ───────────────────────────
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'outreach-sidebar';

    const presetsHtml = TASK_PRESETS
      .map(p => `<button class="preset-chip" data-label="${p.label}">${p.emoji} ${p.label}</button>`)
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

        <!-- Auth -->
        <div id="outreach-auth-required" style="display:none;" class="outreach-center-msg">
          <div style="font-size:32px;margin-bottom:8px;">🔒</div>
          <p>Log in via the extension popup first</p>
        </div>

        <!-- Lead Info -->
        <div id="outreach-lead-info" style="display:none;">
          <!-- Profile card with auto-update badge -->
          <div class="profile-card">
            <div class="profile-name" id="lead-name"></div>
            <div class="profile-subtitle" id="lead-subtitle"></div>
            <div class="profile-updated" id="lead-updated-badge" style="display:none;">
              ↻ Profile data refreshed
            </div>
          </div>

          <!-- Pipeline -->
          <div class="pipeline" id="pipeline"></div>

          <!-- Tasks Section -->
          <div class="section tasks-section">
            <div class="section-header">
              <span class="section-title">📋 Tasks</span>
              <div class="task-counts" id="task-counts"></div>
            </div>
            <div id="tasks-container"></div>

            <!-- Presets -->
            <div class="presets-wrap">${presetsHtml}</div>

            <!-- Add form -->
            <div class="task-add-row">
              <input type="text" id="task-input" placeholder="New task..." class="task-input" />
              <input type="date" id="task-date" class="task-date-input" />
              <button id="task-add-btn" class="btn-add" title="Add">+</button>
            </div>
          </div>

          <!-- Actions Section -->
          <div class="section">
            <div class="section-title" style="margin-bottom:8px;">⚡ Stage Actions</div>
            <div id="actions-container"></div>
          </div>

          <!-- Activity History -->
          <div class="section" id="activity-section" style="display:none;">
            <div class="section-title" style="margin-bottom:8px;">📜 Activity Log</div>
            <div id="activity-container"></div>
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

    // Add task
    document.getElementById('task-add-btn').addEventListener('click', handleAddTask);
    document.getElementById('task-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddTask();
    });

    // Presets
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.getElementById('task-input').value = chip.dataset.label;
        handleAddTask();
      });
    });

    // Default date → tomorrow
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    document.getElementById('task-date').value = tmrw.toISOString().split('T')[0];
  }

  // ───────────────────────────
  // Add / Toggle / Delete Task
  // ───────────────────────────
  async function handleAddTask() {
    if (!currentLead) return;
    const inp = document.getElementById('task-input');
    const dateInp = document.getElementById('task-date');
    const btn = document.getElementById('task-add-btn');

    const taskType = inp.value.trim();
    if (!taskType) {
      inp.focus();
      inp.classList.add('shake');
      setTimeout(() => inp.classList.remove('shake'), 500);
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳';

    try {
      const body = { lead_id: currentLead.id, type: taskType };
      if (dateInp.value) body.due_at = new Date(dateInp.value + 'T12:00:00').toISOString();
      await api('POST', '/tasks', body);
      inp.value = '';
      showToast('Task added ✓');
      await reloadTasks();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '+';
    }
  }

  async function toggleTask(taskId, newStatus) {
    try {
      await api('PATCH', `/tasks/${taskId}`, { status: newStatus });
      showToast(newStatus === 'done' ? 'Done ✓' : 'Reopened');
      await reloadTasks();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function deleteTask(taskId) {
    try {
      await api('DELETE', `/tasks/${taskId}`);
      showToast('Deleted');
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
        renderTasks();
      }
    } catch (_) { /* silent */ }
  }

  // ───────────────────────────
  // Toast
  // ───────────────────────────
  function showToast(text, type = 'success') {
    let toast = document.getElementById('outreach-toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'outreach-toast';
    toast.className = `outreach-toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.textContent = text;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ───────────────────────────
  // Load lead data + AUTO-UPDATE
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
        currentEvents = result.events || [];

        // ── AUTO-UPDATE: compare extracted data with stored data ──
        await autoUpdateLead(profile, result.lead);

        renderLeadInfo();
        return;
      }

      // Lead not found → create
      if (!profile.name) {
        showError('Could not extract profile name. Refresh the page.');
        return;
      }

      const createResult = await api('POST', '/leads', profile);
      currentLead = createResult.lead;
      currentTasks = [];
      currentEvents = [];
      showToast('Lead auto-created ✓');
      renderLeadInfo();

    } catch (err) {
      if (err.message.includes('already exists')) {
        try {
          const retry = await api('GET', `/leads/by-url?url=${encodeURIComponent(profile.linkedin_url)}`);
          if (retry.lead) {
            currentLead = retry.lead;
            currentTasks = retry.tasks || [];
            currentEvents = retry.events || [];
            renderLeadInfo();
            return;
          }
        } catch (_) { /* ignore */ }
      }
      console.warn('[Outreach] Load error:', err.message);
      showError('Connection error. Is the server running?');
    }
  }

  /**
   * Auto-update: If the page shows different data than what's stored,
   * update the lead record. Includes sanity checks to avoid overwriting
   * good data with bad extraction results.
   */
  async function autoUpdateLead(extracted, stored) {
    const changes = {};

    // Sanity check: extracted value must be reasonable (not junk)
    function isValid(val, field) {
      if (!val || val.length < 2) return false;
      if (val.length > 200) return false;
      // Reject common extraction garbage
      const junk = /^(follow|message|connect|pending|subscribe|more|report|block|loading|see more|view|null|undefined)$/i;
      if (junk.test(val)) return false;
      // Name should have at least one space (first + last name)
      if (field === 'name' && !val.includes(' ') && val.length < 3) return false;
      return true;
    }

    if (isValid(extracted.name, 'name') && extracted.name !== stored.name) {
      changes.name = extracted.name;
    }
    if (isValid(extracted.title, 'title') && extracted.title !== stored.title) {
      changes.title = extracted.title;
    }
    if (isValid(extracted.company, 'company') && extracted.company !== stored.company) {
      changes.company = extracted.company;
    }
    if (isValid(extracted.location, 'location') && extracted.location !== stored.location) {
      changes.location = extracted.location;
    }

    if (Object.keys(changes).length > 0) {
      try {
        const result = await api('PATCH', `/leads/${stored.id}`, changes);
        if (result.lead) {
          currentLead = result.lead;
          const badge = document.getElementById('lead-updated-badge');
          if (badge) {
            badge.style.display = 'block';
            setTimeout(() => { badge.style.display = 'none'; }, 4000);
          }
          console.log('[Outreach] Auto-updated:', Object.keys(changes).join(', '));
        }
      } catch (err) {
        console.warn('[Outreach] Auto-update failed:', err.message);
      }
    }
  }

  // ───────────────────────────
  // Render: Lead Info
  // ───────────────────────────
  function renderLeadInfo() {
    showSection('outreach-lead-info');

    document.getElementById('lead-name').textContent = currentLead.name;
    document.getElementById('lead-subtitle').textContent =
      [currentLead.title, currentLead.company].filter(Boolean).join(' · ') || 'No details yet';

    renderPipeline();
    renderTasks();
    renderActions();
    renderActivity();
  }

  // ───────────────────────────
  // Render: Pipeline
  // ───────────────────────────
  function renderPipeline() {
    const el = document.getElementById('pipeline');
    const ci = STAGES.indexOf(currentLead.stage);

    el.innerHTML = STAGES.map((s, i) => {
      let cls = 'pipe-step';
      if (i < ci) cls += ' passed';
      if (i === ci) cls += ' active';
      return `<div class="${cls}"><span class="pipe-dot"></span><span class="pipe-lbl">${s}</span></div>`;
    }).join('<div class="pipe-line"></div>');
  }

  // ───────────────────────────
  // Render: Tasks (grouped by urgency)
  // ───────────────────────────
  function renderTasks() {
    const container = document.getElementById('tasks-container');
    const countsEl = document.getElementById('task-counts');

    const open = currentTasks.filter(t => t.status === 'open');
    const done = currentTasks.filter(t => t.status === 'done');
    const overdue = open.filter(t => new Date(t.due_at) < new Date());
    const today = open.filter(t => {
      const d = relativeDate(t.due_at);
      return d.label === 'Today';
    });
    const upcoming = open.filter(t => {
      const d = relativeDate(t.due_at);
      return d.cls === 'date-tomorrow' || d.cls === 'date-upcoming' || d.cls === 'date-future';
    });

    // Counts badges
    countsEl.innerHTML = '';
    if (overdue.length > 0) {
      countsEl.innerHTML += `<span class="count-badge overdue-badge">${overdue.length} overdue</span>`;
    }
    if (open.length > 0) {
      countsEl.innerHTML += `<span class="count-badge open-badge">${open.length} open</span>`;
    }

    if (currentTasks.length === 0) {
      container.innerHTML = `
        <div class="tasks-empty">
          <div style="font-size:24px;margin-bottom:6px;">📝</div>
          <div>No tasks yet</div>
          <div style="font-size:11px;color:#bbb;margin-top:2px;">Use presets below or type a custom task</div>
        </div>`;
      return;
    }

    let html = '';

    // Overdue group
    if (overdue.length > 0) {
      html += `<div class="task-group">
        <div class="task-group-header overdue-header">
          <span class="pulse-dot"></span> Overdue (${overdue.length})
        </div>
        ${overdue.sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map(t => renderTaskItem(t)).join('')}
      </div>`;
    }

    // Today group
    if (today.length > 0) {
      html += `<div class="task-group">
        <div class="task-group-header today-header">📌 Today (${today.length})</div>
        ${today.map(t => renderTaskItem(t)).join('')}
      </div>`;
    }

    // Upcoming group
    if (upcoming.length > 0) {
      html += `<div class="task-group">
        <div class="task-group-header">📅 Upcoming (${upcoming.length})</div>
        ${upcoming.sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map(t => renderTaskItem(t)).join('')}
      </div>`;
    }

    // Done group (collapsed)
    if (done.length > 0) {
      html += `<div class="task-group done-group">
        <div class="task-group-header done-header" id="toggle-done">
          ✅ Done (${done.length}) <span class="toggle-arrow">▸</span>
        </div>
        <div class="done-list" id="done-list" style="display:none;">
          ${done.slice(0, 10).map(t => renderTaskItem(t)).join('')}
          ${done.length > 10 ? `<div class="tasks-more">+${done.length - 10} more</div>` : ''}
        </div>
      </div>`;
    }

    container.innerHTML = html;

    // Toggle done section
    const toggleDone = container.querySelector('#toggle-done');
    if (toggleDone) {
      toggleDone.addEventListener('click', () => {
        const list = container.querySelector('#done-list');
        const arrow = toggleDone.querySelector('.toggle-arrow');
        const show = list.style.display === 'none';
        list.style.display = show ? 'block' : 'none';
        arrow.textContent = show ? '▾' : '▸';
      });
    }

    // Task action listeners
    container.querySelectorAll('.task-check').forEach(btn => {
      btn.addEventListener('click', () => toggleTask(btn.dataset.id, btn.dataset.to));
    });
    container.querySelectorAll('.task-del').forEach(btn => {
      btn.addEventListener('click', () => deleteTask(btn.dataset.id));
    });
  }

  function renderTaskItem(t) {
    const isDone = t.status === 'done';
    const rd = relativeDate(t.due_at);
    const isOverdue = !isDone && rd.cls === 'date-overdue';
    const icon = isDone ? '✅' : isOverdue ? '🔴' : '⬜';

    return `
      <div class="task-item ${isDone ? 'task-done' : ''} ${isOverdue ? 'task-overdue' : ''}">
        <button class="task-check" data-id="${t.id}" data-to="${isDone ? 'open' : 'done'}" title="${isDone ? 'Reopen' : 'Complete'}">${icon}</button>
        <div class="task-body">
          <span class="task-name ${isDone ? 'task-strike' : ''}">${escHtml(t.type)}</span>
          <span class="task-due ${rd.cls}">${rd.label}</span>
        </div>
        <button class="task-del" data-id="${t.id}" title="Delete">✕</button>
      </div>`;
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ───────────────────────────
  // Render: Stage Actions
  // ───────────────────────────
  function renderActions() {
    const el = document.getElementById('actions-container');
    const ci = STAGES.indexOf(currentLead.stage);

    const BTN = [
      { ev: 'invite_sent', emoji: '📩', lbl: 'Invite Sent', cls: 'invite' },
      { ev: 'connected', emoji: '🤝', lbl: 'Connected', cls: 'connected' },
      { ev: 'message_sent', emoji: '💬', lbl: 'Message Sent', cls: 'message' },
      { ev: 'reply_received', emoji: '📨', lbl: 'Reply Received', cls: 'reply' },
      { ev: 'meeting_booked', emoji: '📅', lbl: 'Meeting Booked', cls: 'meeting' },
    ];

    el.innerHTML = BTN.map(b => {
      const ts = Object.entries(EVENT_FOR_STAGE).find(([_, e]) => e === b.ev);
      const ti = ts ? STAGES.indexOf(ts[0]) : -1;
      const passed = ti <= ci;
      const next = ti === ci + 1;

      return `
        <button class="action-btn action-${b.cls} ${passed ? 'passed' : ''} ${next ? 'next-action' : ''}"
                data-event="${b.ev}" ${passed ? 'disabled' : ''}>
          <span>${b.emoji} ${b.lbl}</span>
          ${passed ? '<span class="act-check">✓</span>' : ''}
          ${next ? '<span class="act-next">NEXT</span>' : ''}
        </button>`;
    }).join('');

    el.querySelectorAll('.action-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="outreach-spinner-small"></span> Recording...';
        try {
          await api('POST', '/events', { lead_id: currentLead.id, type: btn.dataset.event });
          showToast('Stage updated ✓');
          await loadLeadData();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });
  }

  // ───────────────────────────
  // Render: Activity Log
  // ───────────────────────────
  function renderActivity() {
    const section = document.getElementById('activity-section');
    const container = document.getElementById('activity-container');

    if (!currentEvents || currentEvents.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Sort newest first
    const sorted = [...currentEvents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = sorted.map(ev => {
      const info = EVENT_LABELS[ev.type] || { icon: '📌', label: ev.type };
      const date = new Date(ev.created_at);
      const timeAgo = getTimeAgo(date);
      return `
        <div class="activity-item">
          <span class="activity-icon">${info.icon}</span>
          <div class="activity-details">
            <span class="activity-label">${info.label}</span>
            <span class="activity-time" title="${date.toLocaleString()}">${timeAgo}</span>
          </div>
        </div>`;
    }).join('');
  }

  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ───────────────────────────
  // Helpers
  // ───────────────────────────
  function showSection(id) {
    ['outreach-loading', 'outreach-lead-info', 'outreach-auth-required', 'outreach-error']
      .forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = s === id ? 'block' : 'none';
      });
  }

  function showError(msg) {
    showSection('outreach-error');
    const el = document.getElementById('outreach-error');
    if (el) el.innerHTML = `<div style="font-size:28px;margin-bottom:8px;">⚠️</div><p>${msg}</p>`;
  }

  // ───────────────────────────
  // SPA nav detection
  // ───────────────────────────
  let lastUrl = window.location.href;
  function watchNav() {
    setInterval(() => {
      const cur = window.location.href;
      if (cur !== lastUrl) {
        lastUrl = cur;
        if (cur.includes('linkedin.com/in/')) {
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
    watchNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
