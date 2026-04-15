(() => {
  // Prevent double-injection
  if (window.__srInjected) return;
  window.__srInjected = true;

  let words = [], idx = 0, playing = false, timer = null, wpm = 700, fontSize = 44, isLight = false;
  let playStartTime = null, totalPlayMs = 0, wordsReadCount = 0;
  let pasteBoxVisible = true;
  let overlay = null;

  // ── Build overlay DOM ────────────────────────────────────────────────────
  function buildOverlay() {
    if (document.getElementById('sr-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'sr-overlay';
    overlay.innerHTML = `
      <div id="sr-panel">
        <div id="sr-end-screen">
          <div class="sr-end-title">session complete</div>
          <div class="sr-end-stats">
            <div class="sr-end-stat">
              <span class="sr-end-stat-value" id="sr-end-wpm">—</span>
              <span class="sr-end-stat-label">avg wpm</span>
            </div>
            <div class="sr-end-divider"></div>
            <div class="sr-end-stat">
              <span class="sr-end-stat-value" id="sr-end-time">—</span>
              <span class="sr-end-stat-label">reading time</span>
            </div>
            <div class="sr-end-divider"></div>
            <div class="sr-end-stat">
              <span class="sr-end-stat-value" id="sr-end-words">—</span>
              <span class="sr-end-stat-label">words read</span>
            </div>
          </div>
          <div class="sr-end-btn-row">
            <button class="sr-btn sr-primary" id="sr-end-close">close</button>
            <button class="sr-btn" id="sr-end-again">read again</button>
          </div>
        </div>
        <div id="sr-display" title="Click to play / pause">
          <span id="sr-before"></span>
          <span id="sr-pivot">select text &amp; right-click</span>
          <span id="sr-after"></span>
          <div id="sr-status"></div>
        </div>

        <div id="sr-context">
          <div id="sr-context-scroll">
            <div id="sr-context-text"></div>
          </div>
          <div id="sr-ctx-hint">click any word to jump there</div>
        </div>

        <div id="sr-progress-wrap"><div id="sr-progress"></div></div>

        <div id="sr-paste-area">
          <textarea id="sr-paste" placeholder="Or paste text here…"></textarea>
          <div id="sr-word-count">0 words</div>
        </div>

        <div id="sr-controls">
          <div class="sr-ctrl-row">
            <span class="sr-label">WPM</span>
            <div class="sr-stepper">
              <button class="sr-btn sr-icon" id="sr-wpm-down">&#8722;</button>
              <span class="sr-wpm-num" id="sr-wpm-num">700</span>
              <button class="sr-btn sr-icon" id="sr-wpm-up">+</button>
            </div>
            <input type="range" id="sr-wpm-slider" min="50" max="1000" step="10" value="700">
          </div>
          <div class="sr-ctrl-row">
            <span class="sr-label">Size</span>
            <input type="range" id="sr-size-slider" min="20" max="80" step="2" value="44">
            <span class="sr-val" id="sr-size-val">44 px</span>
          </div>
          <div class="sr-btn-row">
            <button class="sr-btn sr-primary" id="sr-play-btn">play</button>
            <button class="sr-btn" id="sr-reset-btn">reset</button>
            <div class="sr-sep"></div>
            <button class="sr-btn" id="sr-back-btn" disabled>&#8592; back</button>
            <button class="sr-btn" id="sr-fwd-btn" disabled>forward &#8594;</button>
            <div class="sr-sep"></div>
            <button class="sr-btn" id="sr-paste-toggle">hide text</button>
            <button class="sr-btn" id="sr-theme-btn">light mode</button>
            <button class="sr-btn" id="sr-close-btn">&#x2715; close</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    attachListeners();
    loadSettings();
    g('sr-end-close').addEventListener('click', closeEndScreen);
    g('sr-end-again').addEventListener('click', resetReader);
  }

  // ── Wire up all listeners ────────────────────────────────────────────────
  function attachListeners() {
    g('sr-display').addEventListener('click', togglePlay);
    g('sr-play-btn').addEventListener('click', togglePlay);
    g('sr-reset-btn').addEventListener('click', resetReader);
    g('sr-back-btn').addEventListener('click', () => { doStop(); showWord(idx - 1); });
    g('sr-fwd-btn').addEventListener('click', () => { doStop(); showWord(idx + 1); });
    g('sr-paste-toggle').addEventListener('click', togglePasteBox);
    g('sr-theme-btn').addEventListener('click', toggleTheme);
    g('sr-close-btn').addEventListener('click', closeOverlay);
    g('sr-wpm-up').addEventListener('click', () => stepWpm(10));
    g('sr-wpm-down').addEventListener('click', () => stepWpm(-10));
    g('sr-wpm-slider').addEventListener('input', e => updateWpm(parseInt(e.target.value)));
    g('sr-size-slider').addEventListener('input', e => updateSize(parseInt(e.target.value)));
    g('sr-paste').addEventListener('input', e => onPasteChange(e.target.value));

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

    // Keyboard shortcuts (scoped to overlay)
    document.addEventListener('keydown', onKey);
  }

  function g(id) { return document.getElementById(id); }

  // ── Keyboard handler ─────────────────────────────────────────────────────
  function onKey(e) {
    if (!overlay || !document.getElementById('sr-overlay')) return;
    if (e.target === g('sr-paste')) return;
    if (e.key === 'Escape')      { closeOverlay(); return; }
    if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); doStop(); showWord(idx - 1); }
    if (e.code === 'ArrowRight') { e.preventDefault(); doStop(); showWord(idx + 1); }
    if (e.code === 'ArrowUp')    { e.preventDefault(); stepWpm(10); }
    if (e.code === 'ArrowDown')  { e.preventDefault(); stepWpm(-10); }
  }

  // ── Settings persistence ─────────────────────────────────────────────────
  function loadSettings() {
    chrome.storage.local.get(['sr_wpm', 'sr_fontSize', 'sr_light'], result => {
      if (result.sr_wpm)      updateWpm(result.sr_wpm);
      if (result.sr_fontSize) updateSize(result.sr_fontSize);
      if (result.sr_light)    { isLight = false; toggleTheme(); }
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ sr_wpm: wpm, sr_fontSize: fontSize, sr_light: isLight });
  }

  // ── Open / close ─────────────────────────────────────────────────────────
  function openOverlay(text) {
    buildOverlay();
    overlay.style.display = 'flex';
    if (text && text.trim()) {
      loadText(text);
    }
  }

  function closeOverlay() {
    doStop();
    saveSettings();
    document.removeEventListener('keydown', onKey);
    if (overlay) { overlay.remove(); overlay = null; }
    window.__srInjected = false;
  }

  // ── Text parser ──────────────────────────────────────────────────────────
  function parseText(raw) {
    if (!raw.trim()) return [];
    let text = raw.replace(/--/g, '—');
    text = text.replace(/([.!?])([)"'\u201C\u201D\u2018\u2019]*)(?=[A-Za-z0-9])/g, '$1$2 ');
    text = text.replace(/—/g, ' — ');
    const tokens = text.trim().split(/\s+/).filter(w => w.length > 0);
    const result = [];
    tokens.forEach(token => {
      if (token === '—' && result.length > 0) result[result.length - 1] += '—';
      else result.push(token);
    });
    return result;
  }

  function loadText(raw) {
    words = parseText(raw);
    g('sr-word-count').textContent = words.length + ' words';
    idx = 0;
    if (words.length) { showWord(0); setPausedUI(); }
  }

  function onPasteChange(raw) {
    totalPlayMs = 0; playStartTime = null; 
    wordsReadCount = 0;
    closeEndScreen();
    doStop(); idx = 0;
    words = parseText(raw);
    g('sr-word-count').textContent = words.length + ' words';
    if (words.length) { showWord(0); setPausedUI(); }
    else {
      g('sr-before').textContent = ''; g('sr-pivot').textContent = 'paste text here'; g('sr-after').textContent = '';
      g('sr-progress').style.width = '0%'; g('sr-status').textContent = '';
      g('sr-context').classList.remove('sr-visible');
      g('sr-back-btn').disabled = true; g('sr-fwd-btn').disabled = true;
    }
  }

  // ── Pivot ────────────────────────────────────────────────────────────────
  function pivotIndex(word) {
    const len = word.replace(/[^a-zA-Z0-9]/g, '').length;
    if (len <= 1) return 0; if (len <= 5) return 1;
    if (len <= 9) return 2; if (len <= 13) return 3; return 4;
  }

  function renderWord(word) {
    const eb = g('sr-before'), ep = g('sr-pivot'), ea = g('sr-after');
    if (!word) { eb.textContent = ''; ep.textContent = ''; ea.textContent = ''; return; }
    const pi = pivotIndex(word);
    eb.textContent = word.slice(0, pi);
    ep.textContent = word.slice(pi, pi + 1);
    ea.textContent = word.slice(pi + 1);
    requestAnimationFrame(() => {
      const pw = ep.getBoundingClientRect().width;
      ea.style.left = 'calc(50% + ' + pw + 'px)';
    });
  }

  // ── Context viewer ───────────────────────────────────────────────────────
  function buildContext() {
    if (!words.length) return;
    const ct = g('sr-context-text');
    const frag = document.createDocumentFragment();
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className = i === idx ? 'sr-ctx-current' : 'sr-ctx-word';
      span.dataset.i = i;
      span.addEventListener('click', function() { jumpTo(parseInt(this.dataset.i)); });
      frag.appendChild(span);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    ct.innerHTML = '';
    ct.appendChild(frag);
    scrollCtxIntoView();
  }

  function updateContextHighlight() {
    const spans = g('sr-context-text').querySelectorAll('span');
    spans.forEach(span => {
      span.className = parseInt(span.dataset.i) === idx ? 'sr-ctx-current' : 'sr-ctx-word';
    });
    scrollCtxIntoView();
  }

  function scrollCtxIntoView() {
    requestAnimationFrame(() => {
      const cs = g('sr-context-scroll');
      const cur = g('sr-context-text').querySelector('.sr-ctx-current');
      if (!cur || !cs) return;
      cs.scrollTop = cur.offsetTop - (cs.clientHeight / 2) + (cur.offsetHeight / 2);
    });
  }

  function jumpTo(i) {
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    g('sr-back-btn').disabled = idx === 0;
    g('sr-fwd-btn').disabled  = idx >= words.length - 1;
    updateContextHighlight();
  }

  // ── Status ───────────────────────────────────────────────────────────────
  function updateStatus() {
    if (!words.length) { g('sr-status').textContent = ''; return; }
    const secLeft = Math.ceil(((words.length - idx) / wpm) * 60);
    const timeStr = secLeft > 60 ? Math.floor(secLeft/60) + 'm ' + (secLeft%60) + 's' : secLeft + 's';
    g('sr-status').textContent = (idx+1) + ' / ' + words.length + '  ·  ~' + timeStr + ' remaining';
    g('sr-progress').style.width = (words.length > 1 ? Math.round((idx/(words.length-1))*100) : 100) + '%';
  }

  function showWord(i) {
    if (!words.length) return;
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    g('sr-back-btn').disabled = idx === 0;
    g('sr-fwd-btn').disabled  = idx >= words.length - 1;
  }

  // ── Timing ───────────────────────────────────────────────────────────────
  function getDelay(word) {
    const base = 60000 / wpm;
    if (word.length > 10) return base * 1.8;
    if (word.length > 6)  return base * 1.3;
    if (/[.!?]/.test(word)) return base * 2.2;
    if (/[,;:—]/.test(word)) return base * 1.5;
    return base;
  }

  // ── UI state ─────────────────────────────────────────────────────────────
  function setPlayingUI() {
    g('sr-context').classList.remove('sr-visible');
    g('sr-paste-area').classList.add('sr-hidden');
    g('sr-paste-toggle').textContent = 'show text';
    pasteBoxVisible = false;
  }

  function setPausedUI() {
    buildContext();
    g('sr-context').classList.add('sr-visible');
    if (pasteBoxVisible) {
      g('sr-paste-area').classList.remove('sr-hidden');
      g('sr-paste-toggle').textContent = 'hide text';
    }
  }

  function togglePasteBox() {
    pasteBoxVisible = !pasteBoxVisible;
    g('sr-paste-area').classList.toggle('sr-hidden', !pasteBoxVisible);
    g('sr-paste-toggle').textContent = pasteBoxVisible ? 'hide text' : 'show text';
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  function tick() {
    if (idx >= words.length - 1) { pauseTiming(); playing = false; if (g('sr-play-btn')) g('sr-play-btn').textContent = 'play'; setPausedUI(); showEndScreen(); return; }
    idx++;
    wordsReadCount++;
    renderWord(words[idx]);
    updateStatus();
    g('sr-back-btn').disabled = idx === 0;
    g('sr-fwd-btn').disabled  = idx >= words.length - 1;
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function play() {
    if (!words.length) return;
    if (idx >= words.length - 1) idx = 0;
    playing = true;
    startTiming();
    g('sr-play-btn').textContent = 'pause';
    setPlayingUI();
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function doStop() {
    playing = false; clearTimeout(timer);
    pauseTiming();
    if (g('sr-play-btn')) g('sr-play-btn').textContent = 'play';
    setPausedUI();
  }

  function togglePlay() { if (!words.length) return; playing ? doStop() : play(); }

  function resetReader() {
    totalPlayMs = 0; playStartTime = null; 
    wordsReadCount = 0;
    closeEndScreen();
    doStop(); idx = 0;
    pasteBoxVisible = true;
    g('sr-paste-area').classList.remove('sr-hidden');
    g('sr-paste-toggle').textContent = 'hide text';
    if (words.length) { showWord(0); buildContext(); g('sr-context').classList.add('sr-visible'); }
    else {
      g('sr-before').textContent = ''; g('sr-pivot').textContent = 'select text & right-click'; g('sr-after').textContent = '';
      g('sr-progress').style.width = '0%'; g('sr-status').textContent = '';
      g('sr-context').classList.remove('sr-visible');
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  function updateWpm(v) {
    wpm = Math.max(50, Math.min(1000, v));
    const n = g('sr-wpm-num'); if (n) n.textContent = wpm;
    const s = g('sr-wpm-slider'); if (s) s.value = wpm;
  }
  function stepWpm(delta) { updateWpm(wpm + delta); }

  function updateSize(v) {
    fontSize = v;
    const px = v + 'px';
    const sv = g('sr-size-val'); if (sv) sv.textContent = v + ' px';
    const ss = g('sr-size-slider'); if (ss) ss.value = v;
    ['sr-before','sr-pivot','sr-after'].forEach(id => {
      const el = g(id); if (el) el.style.fontSize = px;
    });
  }

  function toggleTheme() {
    isLight = !isLight;
    const panel = g('sr-panel');
    if (panel) panel.classList.toggle('sr-light', isLight);
    if (overlay) overlay.classList.toggle('sr-light-mode', isLight);
    const tb = g('sr-theme-btn'); if (tb) tb.textContent = isLight ? 'dark mode' : 'light mode';
  }
  function startTiming() {
    playStartTime = Date.now();
  }

  function pauseTiming() {
    if (playStartTime !== null) {
      totalPlayMs += Date.now() - playStartTime;
      playStartTime = null;
    }
  }

  function showEndScreen() {
    const totalMs  = totalPlayMs;
    const totalMin = totalMs / 60000;
    const avgWpm   = totalMin > 0 ? Math.round(wordsReadCount / totalMin) : 0;
    const totalSec = Math.round(totalMs / 1000);
    const timeStr  = totalSec >= 60
      ? Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's'
      : totalSec + 's';
    const es = g('sr-end-screen');
    if (!es) return;
    g('sr-end-wpm').textContent   = avgWpm;
    g('sr-end-time').textContent  = timeStr;
    g('sr-end-words').textContent = wordsReadCount;
    es.classList.add('sr-visible');
  }

  function closeEndScreen() {
    const es = g('sr-end-screen');
    if (es) es.classList.remove('sr-visible');
  }

  // ── Message listener (from background.js) ────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'openReader') {
      openOverlay(msg.text);
    }
  });

})();
