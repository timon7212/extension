/**
 * Connections Scanner — injected on LinkedIn Connections / My Network pages.
 *
 * v3 Flow:
 *   1. Employee opens Connections page
 *   2. Panel appears → "Start Scan"
 *   3. Auto-scrolls, extracts each connection card
 *   4. Sends batches to POST /api/leads/bulk (UPSERT)
 *   5. Stage = "Connected" for new leads
 *   6. If data is unclear (no title/company visible), sends with data_quality = 'partial'
 *      → will be enriched automatically when employee visits their profile later
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
  // NAME EXTRACTION — robust multi-strategy
  // ───────────────────────────

  function getDirectTextOnly(element) {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  function extractNameFromCard(link, card) {
    // Strategy 1: span[aria-hidden="true"] inside the link
    const ariaSpan = link.querySelector('span[aria-hidden="true"]');
    if (ariaSpan) {
      const text = getDirectTextOnly(ariaSpan) || ariaSpan.textContent.trim();
      if (text && text.length > 1 && text.length < 60) return text;
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

    // Strategy 3: visually-hidden span
    const visuallyHidden = link.querySelector('.visually-hidden');
    if (visuallyHidden) {
      const text = visuallyHidden.textContent.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    // Strategy 4: Direct text of the link
    const directText = getDirectTextOnly(link);
    if (directText && directText.length > 1 && directText.length < 60) return directText;

    // Strategy 5: If link has only ONE span child
    const spans = link.querySelectorAll('span');
    if (spans.length === 1) {
      const text = spans[0].textContent.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    // Strategy 6: link.textContent (last resort, try to clean)
    const fullText = link.textContent.trim();
    if (fullText && fullText.length > 1) {
      const cleaned = cleanNameFromConcatenated(fullText);
      if (cleaned && cleaned.length > 1 && cleaned.length < 60) return cleaned;
    }

    return null;
  }

  function cleanNameFromConcatenated(text) {
    if (!text) return text;

    const titlePatterns = [
      /^(.{2,40}?)((?:CEO|CTO|CPO|COO|CFO|CMO|VP|SVP|EVP)\b.*)$/i,
      /^(.{2,40}?)((?:Co-?[Ff]ounder|Founder|Director|Manager|Engineer|Developer|Designer|Analyst|Consultant|Executive|President|Partner|Head of|Chief)\b.*)$/i,
      /^(.{2,40}?)((?:Senior|Junior|Lead|Staff|Principal)\s+\w+.*)$/i,
      /^(.{2,40}?)((?:Sales|Marketing|Product|Software|Business|Account|Project|Operations|General|Managing)\s+\w+.*)$/i,
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length >= 2) return match[1].trim();
    }

    if (text.includes('\n')) {
      const firstLine = text.split('\n')[0].trim();
      if (firstLine.length > 1) return firstLine;
    }

    return text;
  }

  /**
   * Extract headline/occupation from card — NOT from inside the profile link.
   * Returns empty string if unclear (better to skip than to write garbage).
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

    // Fallback: look for text elements NOT in name link and NOT buttons
    const candidates = card.querySelectorAll('span, p, div');
    for (const el of candidates) {
      if (el.closest('a[href*="/in/"]')) continue;
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

    // Return empty — it's OK, data will be enriched when visiting profile
    return '';
  }

  // ───────────────────────────
  // Extract connections from visible DOM
  // ───────────────────────────
  function extractConnections() {
    const cards = document.querySelectorAll('li');

    for (const card of cards) {
      const link = card.querySelector('a[href*="/in/"]');
      if (!link) continue;

      const href = link.getAttribute('href');
      if (!href || !href.includes('/in/')) continue;

      let cleanUrl = href.split('?')[0].replace(/\/$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://www.linkedin.com' + cleanUrl;
      }

      if (collectedLeads.has(cleanUrl)) continue;

      const name = extractNameFromCard(link, card);
      if (!name || name.length < 2 || name === 'LinkedIn Member') continue;

      // Extract headline — if unclear, leave empty (will be enriched later)
      const headline = extractOccupationFromCard(card, name);

      // Parse company from headline if possible
      let company = '';
      let title = '';
      if (headline) {
        const atMatch = headline.match(/(?:\bat\b|\b@\b)\s+(.+)/i);
        if (atMatch) {
          company = atMatch[1].trim();
          title = headline.replace(/(?:\bat\b|\b@\b)\s+.+/i, '').trim();
        } else {
          title = headline;
        }
      }

      // Determine data quality
      const dataQuality = (title && company) ? 'complete' : (title || company) ? 'partial' : 'partial';

      collectedLeads.set(cleanUrl, {
        linkedin_url: cleanUrl,
        name: name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
        title: title || null,
        company: company || null,
        location: null,
        tenure_months: null,
        data_quality: dataQuality,
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
          <small style="color:#999;">Incomplete profiles will be enriched when you visit them later.</small>
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

    const partialCount = Array.from(collectedLeads.values()).filter(l => !l.title || !l.company).length;
    let statusMsg = `✅ Done! ${totalCreated} new, ${totalUpdated} updated.`;
    if (partialCount > 0) {
      statusMsg += `<br><small style="color:#e65100;">⚠️ ${partialCount} leads have partial data — visit their profiles to enrich.</small>`;
    }
    setStatus(statusMsg);
    log(`🎉 Complete: ${collectedLeads.size} found, ${totalCreated} created, ${totalUpdated} updated, ${partialCount} partial`);

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
