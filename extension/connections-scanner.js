/**
 * Connections Scanner — injected on the LinkedIn Connections page.
 *
 * Onboarding flow:
 *   1. Employee opens their LinkedIn Connections page
 *   2. A panel appears with a "Start Scan" button
 *   3. The scanner auto-scrolls through all connections
 *   4. Extracts name + profile URL + headline for each connection
 *   5. Sends them in batches to POST /api/leads/bulk
 *   6. All imported leads get stage = "Connected"
 *
 * Designed to be stable: handles infinite scroll, deduplication,
 * rate limiting, and graceful error recovery.
 */

(function () {
  'use strict';

  if (document.getElementById('outreach-connections-panel')) return;

  // ───────────────────────────
  // Config
  // ───────────────────────────
  const SCROLL_DELAY = 1200;        // ms between scrolls
  const BATCH_SIZE = 50;            // leads per batch upload
  const MAX_NO_NEW_ROUNDS = 5;      // stop after N scroll rounds with no new connections
  const SCROLL_AMOUNT = 800;        // pixels per scroll

  // ───────────────────────────
  // API helpers (via background service worker)
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
  let collectedLeads = new Map();  // linkedin_url → lead data
  let totalUploaded = 0;
  let totalSkipped = 0;

  // ───────────────────────────
  // Create Panel UI
  // ───────────────────────────
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'outreach-connections-panel';

    panel.innerHTML = `
      <div class="conn-header">
        <span class="conn-header-title">📋 Outreach — Import Connections</span>
        <button class="conn-close" id="conn-close-btn" title="Close">✕</button>
      </div>
      <div class="conn-body">
        <div class="conn-stats">
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-found">0</div>
            <div class="conn-stat-label">Found</div>
          </div>
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-imported">0</div>
            <div class="conn-stat-label">Imported</div>
          </div>
          <div class="conn-stat">
            <div class="conn-stat-value" id="conn-skipped">0</div>
            <div class="conn-stat-label">Skipped</div>
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
          Ready to scan your connections and import them as leads.
        </div>

        <button class="conn-btn conn-btn-primary" id="conn-action-btn">
          🚀 Start Scanning
        </button>

        <div class="conn-log" id="conn-log" style="display:none;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // Close button
    document.getElementById('conn-close-btn').addEventListener('click', () => {
      if (isScanning) {
        shouldStop = true;
        log('⏹ Stopping scan...');
      }
      panel.remove();
    });

    // Action button
    document.getElementById('conn-action-btn').addEventListener('click', handleAction);
  }

  // ───────────────────────────
  // Action button handler
  // ───────────────────────────
  async function handleAction() {
    const btn = document.getElementById('conn-action-btn');

    if (isScanning) {
      // Stop
      shouldStop = true;
      btn.disabled = true;
      btn.textContent = '⏳ Stopping...';
      return;
    }

    // Check auth first
    const ready = await checkReady();
    if (!ready) {
      setStatus('🔒 Please log in via the extension popup first.');
      return;
    }

    // Start scanning
    startScan();
  }

  // ───────────────────────────
  // Scan flow
  // ───────────────────────────
  async function startScan() {
    isScanning = true;
    shouldStop = false;
    collectedLeads.clear();
    totalUploaded = 0;
    totalSkipped = 0;
    updateStats();

    const btn = document.getElementById('conn-action-btn');
    btn.textContent = '⏹ Stop Scanning';
    btn.className = 'conn-btn conn-btn-danger';

    showProgress(true);
    showLog(true);
    log('🔍 Starting scan...');
    setStatus('Scrolling through connections...', true);

    let noNewRounds = 0;
    let scrollRound = 0;

    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(800);

    while (!shouldStop) {
      scrollRound++;
      const beforeCount = collectedLeads.size;

      // Extract visible connections
      extractConnections();
      updateStats();

      const afterCount = collectedLeads.size;
      const newFound = afterCount - beforeCount;

      if (newFound > 0) {
        noNewRounds = 0;
        log(`📋 Round ${scrollRound}: +${newFound} new (total: ${afterCount})`);
      } else {
        noNewRounds++;
        if (noNewRounds >= MAX_NO_NEW_ROUNDS) {
          log('✅ Reached end of connections list');
          break;
        }
      }

      // Batch upload every BATCH_SIZE new leads
      if (collectedLeads.size - totalUploaded - totalSkipped >= BATCH_SIZE) {
        await uploadBatch();
      }

      // Update progress (rough estimate based on scroll position)
      const scrollPct = Math.min(100, Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      ));
      setProgress(scrollPct);

      // Scroll down
      window.scrollBy({ top: SCROLL_AMOUNT, behavior: 'smooth' });
      await sleep(SCROLL_DELAY);
    }

    // Upload remaining
    if (collectedLeads.size > totalUploaded + totalSkipped) {
      await uploadBatch();
    }

    // Done
    isScanning = false;
    setProgress(100);
    setStatus(`✅ Done! Imported ${totalUploaded} leads. ${totalSkipped} duplicates skipped.`);
    log(`🎉 Scan complete: ${collectedLeads.size} found, ${totalUploaded} imported, ${totalSkipped} skipped`);

    btn.textContent = '🔄 Scan Again';
    btn.className = 'conn-btn conn-btn-primary';
    btn.disabled = false;
  }

  // ───────────────────────────
  // Extract connections from visible DOM
  // ───────────────────────────
  function extractConnections() {
    // Strategy 1: Modern LinkedIn connection cards
    // Look for all links to profiles (/in/username)
    const profileLinks = document.querySelectorAll('a[href*="/in/"]');

    for (const link of profileLinks) {
      const href = link.getAttribute('href');
      if (!href || !href.includes('/in/')) continue;

      // Build clean URL
      let cleanUrl = href.split('?')[0].replace(/\/$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://www.linkedin.com' + cleanUrl;
      }

      // Skip if already collected
      if (collectedLeads.has(cleanUrl)) continue;

      // Extract name — look for text content in the link or nearby elements
      let name = '';

      // Try: span inside the link
      const nameSpan = link.querySelector('span[aria-hidden="true"]');
      if (nameSpan && nameSpan.textContent.trim()) {
        name = nameSpan.textContent.trim();
      }

      // Fallback: direct text content
      if (!name) {
        const linkText = link.textContent.trim();
        // Filter out generic link text
        if (linkText && linkText.length > 1 && linkText.length < 80 &&
            !linkText.toLowerCase().includes('view profile') &&
            !linkText.toLowerCase().includes('see all')) {
          name = linkText;
        }
      }

      // Skip entries without a name
      if (!name || name.length < 2) continue;

      // Clean up name (remove "LinkedIn Member" or just initials)
      if (name === 'LinkedIn Member') continue;

      // Extract headline/occupation — look in the card container
      let headline = '';
      const card = link.closest('li') || link.closest('[class*="card"]') || link.parentElement?.parentElement;
      if (card) {
        // Look for occupation/headline text
        const occSelectors = [
          '[class*="occupation"]',
          '[class*="subline"]',
          '.mn-connection-card__occupation',
          'span.t-14.t-normal.t-black--light',
        ];
        for (const sel of occSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim()) {
            headline = el.textContent.trim();
            break;
          }
        }

        // Fallback: look for any smaller text that looks like a headline
        if (!headline) {
          const spans = card.querySelectorAll('span, p');
          for (const s of spans) {
            const t = s.textContent.trim();
            if (t && t !== name && t.length > 5 && t.length < 200 &&
                !t.includes('Connect') && !t.includes('Message') &&
                !t.includes('ago') && !t.includes('mutual')) {
              headline = t;
              break;
            }
          }
        }
      }

      // Parse company from headline (e.g. "Software Engineer at Google")
      let company = '';
      if (headline) {
        const atMatch = headline.match(/(?:at|@)\s+(.+)/i);
        if (atMatch) company = atMatch[1].trim();
      }

      collectedLeads.set(cleanUrl, {
        linkedin_url: cleanUrl,
        name: name.replace(/\n/g, ' ').trim(),
        title: headline.replace(/\n/g, ' ').trim() || null,
        company: company || null,
        location: null,
      });
    }
  }

  // ───────────────────────────
  // Upload batch to backend
  // ───────────────────────────
  async function uploadBatch() {
    const allLeads = Array.from(collectedLeads.values());
    const toUpload = allLeads.slice(totalUploaded + totalSkipped);

    if (toUpload.length === 0) return;

    setStatus(`📤 Uploading ${toUpload.length} leads...`, true);
    log(`📤 Uploading batch of ${toUpload.length} leads...`);

    try {
      const result = await api('POST', '/leads/bulk', { leads: toUpload });
      totalUploaded += result.created || 0;
      totalSkipped += result.skipped || 0;
      updateStats();
      log(`✅ Batch uploaded: +${result.created} new, ${result.skipped} duplicates`);
      setStatus('Scrolling through connections...', true);
    } catch (err) {
      log(`❌ Upload error: ${err.message}`);
      setStatus('⚠️ Upload error — retrying on next batch', false);
    }
  }

  // ───────────────────────────
  // UI Helpers
  // ───────────────────────────
  function updateStats() {
    const foundEl = document.getElementById('conn-found');
    const importedEl = document.getElementById('conn-imported');
    const skippedEl = document.getElementById('conn-skipped');
    if (foundEl) foundEl.textContent = collectedLeads.size;
    if (importedEl) importedEl.textContent = totalUploaded;
    if (skippedEl) skippedEl.textContent = totalSkipped;
  }

  function setStatus(text, scanning = false) {
    const el = document.getElementById('conn-status');
    if (el) {
      el.textContent = text;
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
    // Only show panel if on a connections-like page
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
