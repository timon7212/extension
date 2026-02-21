/**
 * Connections Scanner — injected on LinkedIn Connections / My Network pages.
 *
 * CPO/CTO Flow:
 *   1. Employee opens Connections page
 *   2. Panel appears → "Start Scan"
 *   3. Auto-scrolls, extracts each connection card separately
 *   4. Sends batches to POST /api/leads/bulk (UPSERT — updates on re-scan)
 *   5. Stage = "Connected" for new leads
 *
 * Parsing strategy (robust against LinkedIn DOM changes):
 *   - Each connection card is an <li> in the list
 *   - Name: span[aria-hidden="true"] inside profile link, OR dedicated name element
 *   - Title: separate element with "occupation" or similar class
 *   - NEVER use link.textContent as fallback (causes name+title concatenation)
 */

(function () {
  'use strict';

  if (document.getElementById('outreach-connections-panel')) return;

  // ───────────────────────────
  // Config
  // ───────────────────────────
  const SCROLL_DELAY = 1200;
  const BATCH_SIZE = 50;
  const MAX_NO_NEW_ROUNDS = 6;
  const SCROLL_AMOUNT = 900;

  // ───────────────────────────
  // API
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
  let isScanning = false;
  let shouldStop = false;
  let collectedLeads = new Map();
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  // ───────────────────────────
  // NAME EXTRACTION — the critical fix
  // ───────────────────────────

  /**
   * Get only the direct text content of an element, ignoring child elements.
   * This prevents grabbing "NameOccupation" from nested spans.
   */
  function getDirectTextOnly(element) {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  /**
   * Attempt to find the name element within a profile link or card.
   * Returns { name, nameElement } or null.
   */
  function extractNameFromCard(link, card) {
    // Strategy 1: span[aria-hidden="true"] inside the link
    // LinkedIn uses this for accessibility — it contains ONLY the name
    const ariaSpan = link.querySelector('span[aria-hidden="true"]');
    if (ariaSpan) {
      const text = getDirectTextOnly(ariaSpan) || ariaSpan.textContent.trim();
      if (text && text.length > 1 && text.length < 60) {
        return text;
      }
    }

    // Strategy 2: Element with "name" in its class
    if (card) {
      for (const sel of [
        '[class*="connection-card__name"]',
        '[class*="entity-result__title"] span[aria-hidden="true"]',
        '[class*="entity-result__title"]',
        '[class*="card__name"]',
        '[data-anonymize="person-name"]',
      ]) {
        const el = card.querySelector(sel);
        if (el) {
          const text = getDirectTextOnly(el) || el.textContent.trim();
          if (text && text.length > 1 && text.length < 60) return text;
        }
      }
    }

    // Strategy 3: First visually-hidden span (screen reader text, clean name)
    const visuallyHidden = link.querySelector('.visually-hidden');
    if (visuallyHidden) {
      const text = visuallyHidden.textContent.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    // Strategy 4: Direct text of the link itself (NOT textContent — just text nodes)
    const directText = getDirectTextOnly(link);
    if (directText && directText.length > 1 && directText.length < 60) {
      return directText;
    }

    // Strategy 5: If link has only ONE span child, use that
    const spans = link.querySelectorAll('span');
    if (spans.length === 1) {
      const text = spans[0].textContent.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    // Strategy 6 (LAST RESORT): link.textContent but try to clean it
    const fullText = link.textContent.trim();
    if (fullText && fullText.length > 1) {
      // Try to detect name+title concatenation by looking for common title patterns
      const cleaned = cleanNameFromConcatenated(fullText);
      if (cleaned && cleaned.length > 1 && cleaned.length < 60) return cleaned;
    }

    return null;
  }

  /**
   * If we got a concatenated "NameTitle" string, try to split it.
   * Looks for transition point where name ends and title begins.
   */
  function cleanNameFromConcatenated(text) {
    if (!text) return text;

    // Common patterns where title starts (case-insensitive match)
    const titlePatterns = [
      /^(.{2,40}?)((?:CEO|CTO|CPO|COO|CFO|CMO|VP|SVP|EVP)\b.*)$/i,
      /^(.{2,40}?)((?:Co-?[Ff]ounder|Founder|Director|Manager|Engineer|Developer|Designer|Analyst|Consultant|Executive|President|Partner|Head of|Chief)\b.*)$/i,
      /^(.{2,40}?)((?:Senior|Junior|Lead|Staff|Principal)\s+\w+.*)$/i,
      /^(.{2,40}?)((?:Sales|Marketing|Product|Software|Business|Account|Project|Operations|General|Managing)\s+\w+.*)$/i,
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length >= 2) {
        return match[1].trim();
      }
    }

    // If text has no spaces and is long (like "AdilbeckKamash") — probably OK, it's just a name
    // If text has newlines, take first line
    if (text.includes('\n')) {
      const firstLine = text.split('\n')[0].trim();
      if (firstLine.length > 1) return firstLine;
    }

    return text;
  }

  /**
   * Extract headline/occupation from card, explicitly NOT from the profile link.
   */
  function extractOccupationFromCard(card, name) {
    if (!card) return '';

    const selectors = [
      '[class*="occupation"]',
      '[class*="connection-card__occupation"]',
      '[class*="entity-result__primary-subtitle"]',
      '[class*="subline"]',
      'span.t-14.t-normal.t-black--light',
      'p.t-14.t-normal',
    ];

    for (const sel of selectors) {
      const el = card.querySelector(sel);
      if (el) {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text && text !== name && text.length > 2 && text.length < 250) {
          return text;
        }
      }
    }

    // Fallback: look for text elements that are NOT the name element
    // and NOT action buttons
    const candidates = card.querySelectorAll('span, p, div');
    for (const el of candidates) {
      // Skip if it's inside the link (that's the name area)
      if (el.closest('a[href*="/in/"]')) continue;
      // Skip buttons
      if (el.closest('button')) continue;

      const text = el.textContent.trim().replace(/\s+/g, ' ');
      if (text && text !== name && text.length > 3 && text.length < 250 &&
          !text.includes('Connect') && !text.includes('Message') &&
          !text.includes('Follow') && !text.includes('mutual') &&
          !text.includes('ago') && !text.includes('Pending') &&
          !text.match(/^\d+ (connection|follower)/i)) {
        return text;
      }
    }

    return '';
  }

  // ───────────────────────────
  // Extract connections from visible DOM
  // ───────────────────────────
  function extractConnections() {
    // Find all list items that contain profile links
    const cards = document.querySelectorAll('li');

    for (const card of cards) {
      // Find profile link in this card
      const link = card.querySelector('a[href*="/in/"]');
      if (!link) continue;

      const href = link.getAttribute('href');
      if (!href || !href.includes('/in/')) continue;

      // Build clean URL
      let cleanUrl = href.split('?')[0].replace(/\/$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://www.linkedin.com' + cleanUrl;
      }

      // Skip if already collected
      if (collectedLeads.has(cleanUrl)) continue;

      // Extract name using robust strategy
      const name = extractNameFromCard(link, card);
      if (!name || name.length < 2 || name === 'LinkedIn Member') continue;

      // Extract occupation (NOT from inside the link!)
      const headline = extractOccupationFromCard(card, name);

      // Parse company from headline
      let company = '';
      if (headline) {
        const atMatch = headline.match(/(?:\bat\b|\b@\b)\s+(.+)/i);
        if (atMatch) company = atMatch[1].trim();
      }

      collectedLeads.set(cleanUrl, {
        linkedin_url: cleanUrl,
        name: name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
        title: headline ? headline.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : null,
        company: company || null,
        location: null,
      });
    }
  }

  // ───────────────────────────
  // Panel UI
  // ───────────────────────────
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'outreach-connections-panel';

    panel.innerHTML = `
      <div class="conn-header">
        <span class="conn-header-title">📋 Import Connections</span>
        <button class="conn-close" id="conn-close-btn" title="Close">✕</button>
      </div>
      <div class="conn-body">
        <div class="conn-stats">
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-found">0</div>
            <div class="conn-stat-label">Found</div>
          </div>
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-created">0</div>
            <div class="conn-stat-label">New</div>
          </div>
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-updated">0</div>
            <div class="conn-stat-label">Updated</div>
          </div>
        </div>

        <div class="conn-progress-wrap" id="conn-progress-wrap" style="display:none;">
          <div class="conn-progress-text">
            <span id="conn-progress-label">Scanning...</span>
            <span id="conn-progress-pct">0%</span>
          </div>
          <div class="conn-progress-bar">
            <div class="conn-progress-fill" id="conn-progress-fill"></div>
          </div>
        </div>

        <div class="conn-status" id="conn-status">
          Scan your connections to import them as leads.<br>
          <small style="color:#999;">Re-scanning updates existing records.</small>
        </div>

        <button class="conn-btn conn-btn-primary" id="conn-action-btn">
          🚀 Start Scanning
        </button>

        <div class="conn-log" id="conn-log" style="display:none;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('conn-close-btn').addEventListener('click', () => {
      if (isScanning) { shouldStop = true; }
      panel.remove();
    });

    document.getElementById('conn-action-btn').addEventListener('click', handleAction);
  }

  // ───────────────────────────
  // Scan flow
  // ───────────────────────────
  async function handleAction() {
    const btn = document.getElementById('conn-action-btn');
    if (isScanning) {
      shouldStop = true;
      btn.disabled = true;
      btn.textContent = '⏳ Stopping...';
      return;
    }

    const ready = await checkReady();
    if (!ready) {
      setStatus('🔒 Log in via the extension popup first.');
      return;
    }

    startScan();
  }

  async function startScan() {
    isScanning = true;
    shouldStop = false;
    collectedLeads.clear();
    totalCreated = 0;
    totalUpdated = 0;
    totalSkipped = 0;
    updateStats();

    const btn = document.getElementById('conn-action-btn');
    btn.textContent = '⏹ Stop';
    btn.className = 'conn-btn conn-btn-danger';

    showProgress(true);
    showLog(true);
    log('🔍 Scanning connections...');
    setStatus('Auto-scrolling through connections...', true);

    let noNewRounds = 0;
    let scrollRound = 0;
    let lastUploadCount = 0;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(800);

    while (!shouldStop) {
      scrollRound++;
      const beforeCount = collectedLeads.size;

      extractConnections();
      updateStats();

      const afterCount = collectedLeads.size;
      const newFound = afterCount - beforeCount;

      if (newFound > 0) {
        noNewRounds = 0;
        log(`📋 Round ${scrollRound}: +${newFound} (total: ${afterCount})`);
      } else {
        noNewRounds++;
        if (noNewRounds >= MAX_NO_NEW_ROUNDS) {
          log('✅ Reached end of connections list');
          break;
        }
      }

      // Upload batch
      const pendingUpload = collectedLeads.size - lastUploadCount;
      if (pendingUpload >= BATCH_SIZE) {
        await uploadBatch(lastUploadCount);
        lastUploadCount = collectedLeads.size;
      }

      const scrollPct = Math.min(99, Math.round(
        (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * 100
      ));
      setProgress(scrollPct);

      window.scrollBy({ top: SCROLL_AMOUNT, behavior: 'smooth' });
      await sleep(SCROLL_DELAY);
    }

    // Final batch
    if (collectedLeads.size > lastUploadCount) {
      await uploadBatch(lastUploadCount);
    }

    isScanning = false;
    setProgress(100);
    setStatus(`✅ Done! ${totalCreated} new, ${totalUpdated} updated.`);
    log(`🎉 Complete: ${collectedLeads.size} found, ${totalCreated} created, ${totalUpdated} updated`);

    btn.textContent = '🔄 Scan Again';
    btn.className = 'conn-btn conn-btn-primary';
    btn.disabled = false;
  }

  async function uploadBatch(fromIndex) {
    const allLeads = Array.from(collectedLeads.values());
    const toUpload = allLeads.slice(fromIndex);
    if (toUpload.length === 0) return;

    setStatus(`📤 Uploading ${toUpload.length} leads...`, true);
    log(`📤 Uploading ${toUpload.length} leads...`);

    try {
      const result = await api('POST', '/leads/bulk', { leads: toUpload });
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
      totalSkipped += result.skipped || 0;
      updateStats();
      log(`✅ +${result.created} new, ${result.updated} updated, ${result.skipped} skipped`);
      setStatus('Auto-scrolling through connections...', true);
    } catch (err) {
      log(`❌ Upload error: ${err.message}`);
    }
  }

  // ───────────────────────────
  // UI helpers
  // ───────────────────────────
  function updateStats() {
    const el = (id) => document.getElementById(id);
    if (el('conn-found')) el('conn-found').textContent = collectedLeads.size;
    if (el('conn-created')) el('conn-created').textContent = totalCreated;
    if (el('conn-updated')) el('conn-updated').textContent = totalUpdated;
  }

  function setStatus(text, scanning = false) {
    const el = document.getElementById('conn-status');
    if (el) {
      el.innerHTML = text;
      el.className = `conn-status ${scanning ? 'conn-status-scanning' : ''}`;
    }
  }

  function showProgress(visible) {
    const el = document.getElementById('conn-progress-wrap');
    if (el) el.style.display = visible ? 'block' : 'none';
  }

  function setProgress(pct) {
    const fill = document.getElementById('conn-progress-fill');
    const pctEl = document.getElementById('conn-progress-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }

  function showLog(visible) {
    const el = document.getElementById('conn-log');
    if (el) el.style.display = visible ? 'block' : 'none';
  }

  function log(msg) {
    const el = document.getElementById('conn-log');
    if (!el) return;
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerHTML += `<div>[${time}] ${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ───────────────────────────
  // Init
  // ───────────────────────────
  function init() {
    const url = window.location.href;
    if (url.includes('/mynetwork/invite-connect/connections') ||
        url.includes('/mynetwork') ||
        url.includes('/search/results/people')) {
      createPanel();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
