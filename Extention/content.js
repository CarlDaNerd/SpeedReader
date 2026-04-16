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
      <div id="app">

        <div id="end-screen">
          <div class="end-title">session complete</div>
          <div class="end-stats">
            <div class="end-stat">
              <span class="end-stat-value" id="end-wpm">—</span>
              <span class="end-stat-label">avg wpm</span>
            </div>
            <div class="end-divider"></div>
            <div class="end-stat">
              <span class="end-stat-value" id="end-time">—</span>
              <span class="end-stat-label">reading time</span>
            </div>
            <div class="end-divider"></div>
            <div class="end-stat">
              <span class="end-stat-value" id="end-words">—</span>
              <span class="end-stat-label">words read</span>
            </div>
          </div>
          <div class="end-btn-row">
            <button class="btn primary" id="end-close">close</button>
            <button class="btn" id="end-again">read again</button>
          </div>
        </div>

        <div id="display-area" title="Click to play / pause">
          <span id="word-before"></span>
          <span id="word-pivot">select text &amp; right-click</span>
          <span id="word-after"></span>
          <div id="status-overlay"></div>
        </div>

        <div id="context-viewer">
          <div id="context-scroll">
            <div id="context-text"></div>
          </div>
          <div class="ctx-hint">click any word to jump there</div>
        </div>

        <div id="progress-bar-wrap"><div id="progress-bar"></div></div>

        <div id="text-input-area">
          <textarea id="text-input" placeholder="Or paste text here…"></textarea>
          <div id="word-counter">0 words</div>
        </div>

        <div id="sr-controls">
          <div class="ctrl-row">
            <span class="ctrl-label">WPM</span>
            <div class="wpm-stepper">
              <button class="btn icon" id="wpm-down">&#8722;</button>
              <span class="wpm-num" id="wpm-num">700</span>
              <button class="btn icon" id="wpm-up">+</button>
            </div>
            <input type="range" id="wpm-slider" min="50" max="1000" step="10" value="700">
          </div>
          <div class="ctrl-row">
            <span class="ctrl-label">Size</span>
            <input type="range" id="size-slider" min="20" max="80" step="2" value="44">
            <span class="ctrl-val" id="size-val">44 px</span>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="play-btn">play</button>
            <button class="btn" id="sr-reset-btn">reset</button>
            <div class="sep"></div>
            <button class="btn" id="back-btn" disabled>&#8592; back</button>
            <button class="btn" id="fwd-btn" disabled>forward &#8594;</button>
            <div class="sep"></div>
            <button class="btn" id="paste-toggle-btn">hide text</button>
            <button class="btn" id="theme-btn">light mode</button>
            <button class="btn" id="sr-close-btn">&#x2715; close</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    attachListeners();
    loadSettings();
  }

  // ── Wire up all listeners ────────────────────────────────────────────────
  function attachListeners() {
    g('display-area').addEventListener('click', togglePlay);
    g('play-btn').addEventListener('click', togglePlay);
    g('sr-reset-btn').addEventListener('click', resetReader);
    g('back-btn').addEventListener('click', () => { doStop(); showWord(idx - 1); });
    g('fwd-btn').addEventListener('click', () => { doStop(); showWord(idx + 1); });
    g('paste-toggle-btn').addEventListener('click', togglePasteBox);
    g('theme-btn').addEventListener('click', toggleTheme);
    g('sr-close-btn').addEventListener('click', closeOverlay);
    g('wpm-up').addEventListener('click', () => stepWpm(10));
    g('wpm-down').addEventListener('click', () => stepWpm(-10));
    g('wpm-slider').addEventListener('input', e => updateWpm(parseInt(e.target.value)));
    g('size-slider').addEventListener('input', e => updateSize(parseInt(e.target.value)));
    g('text-input').addEventListener('input', e => onPasteChange(e.target.value));
    g('end-close').addEventListener('click', closeEndScreen);
    g('end-again').addEventListener('click', resetReader);

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

    // Keyboard shortcuts (scoped to overlay)
    document.addEventListener('keydown', onKey);
  }

  function g(id) { return document.getElementById(id); }

  // ── Keyboard handler ─────────────────────────────────────────────────────
  function onKey(e) {
    if (!overlay || !document.getElementById('sr-overlay')) return;
    if (e.target === g('text-input')) return;
    if (e.key === 'Escape') {
      if (g('end-screen').classList.contains('visible')) { closeEndScreen(); return; }
      closeOverlay(); return;
    }
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

  // ── Text loading ──────────────────────────────────────────────────────────
  function loadText(raw) {
    words = parseText(raw);
    g('word-counter').textContent = words.length + ' words';
    idx = 0;
    if (words.length) { showWord(0); setPausedUI(); }
  }

  function onPasteChange(raw) {
    totalPlayMs = 0; playStartTime = null; wordsReadCount = 0;
    closeEndScreen();
    doStop(); idx = 0;
    words = parseText(raw);
    g('word-counter').textContent = words.length + ' words';
    if (words.length) { showWord(0); setPausedUI(); }
    else {
      g('word-before').textContent = ''; g('word-pivot').textContent = 'paste text here'; g('word-after').textContent = '';
      g('progress-bar').style.width = '0%'; g('status-overlay').textContent = '';
      g('context-viewer').classList.remove('visible');
      g('back-btn').disabled = true; g('fwd-btn').disabled = true;
    }
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

  // ── Pivot ────────────────────────────────────────────────────────────────
  function pivotIndex(word) {
    const len = word.replace(/[^a-zA-Z0-9]/g, '').length;
    if (len <= 1) return 0; if (len <= 5) return 1;
    if (len <= 9) return 2; if (len <= 13) return 3; return 4;
  }

  function renderWord(word) {
    const eb = g('word-before'), ep = g('word-pivot'), ea = g('word-after');
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
    const ct = g('context-text');
    const frag = document.createDocumentFragment();
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className = i === idx ? 'ctx-current' : 'ctx-word';
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
    const spans = g('context-text').querySelectorAll('span');
    spans.forEach(span => {
      span.className = parseInt(span.dataset.i) === idx ? 'ctx-current' : 'ctx-word';
    });
    scrollCtxIntoView();
  }

  function scrollCtxIntoView() {
    requestAnimationFrame(() => {
      const cs = g('context-scroll');
      const cur = g('context-text').querySelector('.ctx-current');
      if (!cur || !cs) return;
      cs.scrollTop = cur.offsetTop - (cs.clientHeight / 2) + (cur.offsetHeight / 2);
    });
  }

  function jumpTo(i) {
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    g('back-btn').disabled = idx === 0;
    g('fwd-btn').disabled  = idx >= words.length - 1;
    updateContextHighlight();
  }

  // ── Status ───────────────────────────────────────────────────────────────
  function updateStatus() {
    if (!words.length) { g('status-overlay').textContent = ''; return; }
    const secLeft = Math.ceil(((words.length - idx) / wpm) * 60);
    const timeStr = secLeft > 60 ? Math.floor(secLeft/60) + 'm ' + (secLeft%60) + 's' : secLeft + 's';
    g('status-overlay').textContent = (idx+1) + ' / ' + words.length + '  ·  ~' + timeStr + ' remaining';
    g('progress-bar').style.width = (words.length > 1 ? Math.round((idx/(words.length-1))*100) : 100) + '%';
  }

  function showWord(i) {
    if (!words.length) return;
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    g('back-btn').disabled = idx === 0;
    g('fwd-btn').disabled  = idx >= words.length - 1;
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

  // ── Session timing helpers ────────────────────────────────────────────────
  function startTiming() {
    playStartTime = Date.now();
  }

  function pauseTiming() {
    if (playStartTime !== null) {
      totalPlayMs += Date.now() - playStartTime;
      playStartTime = null;
    }
  }

  // ── End screen ────────────────────────────────────────────────────────────
  function showEndScreen() {
    const totalMin = totalPlayMs / 60000;
    const avgWpm   = totalMin > 0 ? Math.round(wordsReadCount / totalMin) : 0;
    const totalSec = Math.round(totalPlayMs / 1000);
    const timeStr  = totalSec >= 60
      ? Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's'
      : totalSec + 's';
    const es = g('end-screen');
    if (!es) return;
    g('end-wpm').textContent   = avgWpm;
    g('end-time').textContent  = timeStr;
    g('end-words').textContent = wordsReadCount;
    es.classList.add('visible');
  }

  function closeEndScreen() {
    const es = g('end-screen');
    if (es) es.classList.remove('visible');
  }

  // ── UI state ─────────────────────────────────────────────────────────────
  function setPlayingUI() {
    g('context-viewer').classList.remove('visible');
    g('text-input-area').classList.add('hidden');
    g('paste-toggle-btn').textContent = 'show text';
    pasteBoxVisible = false;
  }

  function setPausedUI() {
    buildContext();
    g('context-viewer').classList.add('visible');
    if (pasteBoxVisible) {
      g('text-input-area').classList.remove('hidden');
      g('paste-toggle-btn').textContent = 'hide text';
    }
  }

  function togglePasteBox() {
    pasteBoxVisible = !pasteBoxVisible;
    g('text-input-area').classList.toggle('hidden', !pasteBoxVisible);
    g('paste-toggle-btn').textContent = pasteBoxVisible ? 'hide text' : 'show text';
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  function tick() {
    if (idx >= words.length - 1) {
      pauseTiming();
      playing = false;
      if (g('play-btn')) g('play-btn').textContent = 'play';
      setPausedUI();
      showEndScreen();
      return;
    }
    idx++;
    wordsReadCount++;
    renderWord(words[idx]);
    updateStatus();
    g('back-btn').disabled = idx === 0;
    g('fwd-btn').disabled  = idx >= words.length - 1;
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function play() {
    if (!words.length) return;
    if (idx >= words.length - 1) idx = 0;
    playing = true;
    startTiming();
    g('play-btn').textContent = 'pause';
    setPlayingUI();
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function doStop() {
    playing = false; clearTimeout(timer);
    pauseTiming();
    if (g('play-btn')) g('play-btn').textContent = 'play';
    setPausedUI();
  }

  function togglePlay() { if (!words.length) return; playing ? doStop() : play(); }

  function resetReader() {
    totalPlayMs = 0; playStartTime = null; wordsReadCount = 0;
    closeEndScreen();
    doStop(); idx = 0;
    pasteBoxVisible = true;
    g('text-input-area').classList.remove('hidden');
    g('paste-toggle-btn').textContent = 'hide text';
    if (words.length) { showWord(0); buildContext(); g('context-viewer').classList.add('visible'); }
    else {
      g('word-before').textContent = ''; g('word-pivot').textContent = 'select text & right-click'; g('word-after').textContent = '';
      g('progress-bar').style.width = '0%'; g('status-overlay').textContent = '';
      g('context-viewer').classList.remove('visible');
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  function updateWpm(v) {
    wpm = Math.max(50, Math.min(1000, v));
    const n = g('wpm-num'); if (n) n.textContent = wpm;
    const s = g('wpm-slider'); if (s) s.value = wpm;
  }
  function stepWpm(delta) { updateWpm(wpm + delta); }

  function updateSize(v) {
    fontSize = v;
    const px = v + 'px';
    const sv = g('size-val'); if (sv) sv.textContent = v + ' px';
    const ss = g('size-slider'); if (ss) ss.value = v;
    ['word-before', 'word-pivot', 'word-after'].forEach(id => {
      const el = g(id); if (el) el.style.fontSize = px;
    });
  }

  function toggleTheme() {
    isLight = !isLight;
    const panel = g('app');
    if (panel) panel.classList.toggle('light', isLight);
    if (overlay) overlay.classList.toggle('sr-light-mode', isLight);
    const tb = g('theme-btn'); if (tb) tb.textContent = isLight ? 'dark mode' : 'light mode';
  }

  // ── Message listener (from background.js) ────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'openReader') {
      openOverlay(msg.text);
    }
  });

})();