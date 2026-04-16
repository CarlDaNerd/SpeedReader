let words = [], idx = 0, playing = false, timer = null, wpm = 700, fontSize = 48, isLight = false;
  let pasteBoxVisible = true;

  // This is a test to see if build.js is functioning correctly.
  // ── Session timing ────────────────────────────────────────────────────────
  // Tracks only active playback time, excluding pauses.
  // playStartTime: timestamp when play() was most recently called.
  // totalPlayMs: accumulated milliseconds of active playback across all play/pause cycles.
  let playStartTime = null;
  let totalPlayMs   = 0;
  let wordsReadCount = 0;

  const elBefore       = document.getElementById('word-before');
  const elPivot        = document.getElementById('word-pivot');
  const elAfter        = document.getElementById('word-after');
  const playBtn        = document.getElementById('play-btn');
  const progressBar    = document.getElementById('progress-bar');
  const statusOverlay  = document.getElementById('status-overlay');
  const backBtn        = document.getElementById('back-btn');
  const fwdBtn         = document.getElementById('fwd-btn');
  const app            = document.getElementById('app');
  const contextViewer  = document.getElementById('context-viewer');
  const contextScroll  = document.getElementById('context-scroll');
  const contextText    = document.getElementById('context-text');
  const textInputArea  = document.getElementById('text-input-area');
  const pasteToggleBtn = document.getElementById('paste-toggle-btn');
  const endScreen      = document.getElementById('end-screen');

  // ── Text parser ───────────────────────────────────────────────────────────
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

  // ── Pivot ─────────────────────────────────────────────────────────────────
  function pivotIndex(word) {
    const len = word.replace(/[^a-zA-Z0-9]/g, '').length;
    if (len <= 1) return 0; if (len <= 5) return 1;
    if (len <= 9) return 2; if (len <= 13) return 3; return 4;
  }

  function renderWord(word) {
    if (!word) { elBefore.textContent = ''; elPivot.textContent = ''; elAfter.textContent = ''; return; }
    const pi = pivotIndex(word);
    elBefore.textContent = word.slice(0, pi);
    elPivot.textContent  = word.slice(pi, pi + 1);
    elAfter.textContent  = word.slice(pi + 1);
    requestAnimationFrame(() => {
      const pw = elPivot.getBoundingClientRect().width;
      elAfter.style.left = 'calc(50% + ' + pw + 'px)';
    });
  }

  // ── Context viewer ────────────────────────────────────────────────────────
  function buildContext() {
    if (!words.length) { contextText.innerHTML = ''; return; }
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
    contextText.innerHTML = '';
    contextText.appendChild(frag);
    scrollCurrentIntoView();
  }

  function updateContextHighlight() {
    const spans = contextText.querySelectorAll('span');
    spans.forEach(span => {
      const i = parseInt(span.dataset.i);
      span.className = i === idx ? 'ctx-current' : 'ctx-word';
    });
    scrollCurrentIntoView();
  }

  function scrollCurrentIntoView() {
    requestAnimationFrame(() => {
      const current = contextText.querySelector('.ctx-current');
      if (!current) return;
      const scrollH = contextScroll.clientHeight;
      const elTop   = current.offsetTop;
      const elH     = current.offsetHeight;
      contextScroll.scrollTop = elTop - (scrollH / 2) + (elH / 2);
    });
  }

  function jumpTo(i) {
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    backBtn.disabled = idx === 0;
    fwdBtn.disabled  = idx >= words.length - 1;
    updateContextHighlight();
  }

  // ── Status ────────────────────────────────────────────────────────────────
  function updateStatus() {
    if (!words.length) { statusOverlay.textContent = ''; return; }
    const secLeft = Math.ceil(((words.length - idx) / wpm) * 60);
    const timeStr = secLeft > 60 ? Math.floor(secLeft/60) + 'm ' + (secLeft%60) + 's' : secLeft + 's';
    statusOverlay.textContent = (idx+1) + ' / ' + words.length + '  ·  ~' + timeStr + ' remaining';
    progressBar.style.width = (words.length > 1 ? Math.round((idx/(words.length-1))*100) : 100) + '%';
  }

  function showWord(i) {
    if (!words.length) return;
    idx = Math.max(0, Math.min(i, words.length - 1));
    renderWord(words[idx]);
    updateStatus();
    backBtn.disabled = idx === 0;
    fwdBtn.disabled  = idx >= words.length - 1;
  }

  // ── Timing ────────────────────────────────────────────────────────────────
  function getDelay(word) {
    const base = 60000 / wpm;
    if (word.length > 10) return base * 1.8;
    if (word.length > 6)  return base * 1.3;
    if (/[.!?]/.test(word)) return base * 2.2;
    if (/[,;:—]/.test(word)) return base * 1.5;
    return base;
  }

  // ── Session timing helpers ────────────────────────────────────────────────
  // Call when playback starts to record the start timestamp.
  function startTiming() {
    playStartTime = Date.now();
  }

  // Call when playback pauses or stops to accumulate elapsed time.
  function pauseTiming() {
    if (playStartTime !== null) {
      totalPlayMs += Date.now() - playStartTime;
      playStartTime = null;
    }
  }

  // Returns the total active playback time in milliseconds,
  // including any currently running segment.
  function getActiveTotalMs() {
    let total = totalPlayMs;
    if (playStartTime !== null) total += Date.now() - playStartTime;
    return total;
  }

  // ── End screen ────────────────────────────────────────────────────────────
  function showEndScreen() {
    const totalMs  = getActiveTotalMs();
    const totalMin = totalMs / 60000;
    const avgWpm   = totalMin > 0 ? Math.round(wordsReadCount / totalMin) : 0;

    // Format time as Xm Ys or just Xs for short reads
    const totalSec = Math.round(totalMs / 1000);
    const timeStr  = totalSec >= 60
      ? Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's'
      : totalSec + 's';

    document.getElementById('end-wpm').textContent   = avgWpm;
    document.getElementById('end-time').textContent  = timeStr;
    document.getElementById('end-words').textContent = wordsReadCount;

    endScreen.classList.add('visible');
  }

  function closeEndScreen() {
    endScreen.classList.remove('visible');
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  function setPlayingUI() {
    contextViewer.classList.remove('visible');
    textInputArea.classList.add('hidden');
    pasteToggleBtn.textContent = 'show text';
    pasteBoxVisible = false;
  }

  function setPausedUI() {
    buildContext();
    contextViewer.classList.add('visible');
    if (pasteBoxVisible) {
      textInputArea.classList.remove('hidden');
      pasteToggleBtn.textContent = 'hide text';
    }
  }

  function togglePasteBox() {
    pasteBoxVisible = !pasteBoxVisible;
    textInputArea.classList.toggle('hidden', !pasteBoxVisible);
    pasteToggleBtn.textContent = pasteBoxVisible ? 'hide text' : 'show text';
  }

  // ── Playback ──────────────────────────────────────────────────────────────
  function tick() {
    if (idx >= words.length - 1) {
      // Finished — record final timing segment then show end screen
      pauseTiming();
      playing = false;
      playBtn.textContent = 'play';
      setPausedUI();
      showEndScreen();
      return;
    }
    idx++;
    wordsReadCount++;
    renderWord(words[idx]);
    updateStatus();
    backBtn.disabled = idx === 0;
    fwdBtn.disabled  = idx >= words.length - 1;
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function play() {
    if (!words.length) return;
    if (idx >= words.length - 1) idx = 0;
    playing = true;
    playBtn.textContent = 'pause';
    startTiming();
    setPlayingUI();
    timer = setTimeout(tick, getDelay(words[idx]));
  }

  function stop() {
    playing = false;
    clearTimeout(timer);
    pauseTiming();
    playBtn.textContent = 'play';
    setPausedUI();
  }

  function togglePlay() { if (!words.length) return; playing ? stop() : play(); }

  function resetReader() {
    stop();
    // Reset all session tracking
    totalPlayMs    = 0;
    playStartTime  = null;
    wordsReadCount = 0;
    idx = 0;
    closeEndScreen();
    pasteBoxVisible = true;
    textInputArea.classList.remove('hidden');
    pasteToggleBtn.textContent = 'hide text';
    if (words.length) { showWord(0); buildContext(); contextViewer.classList.add('visible'); }
    else {
      elBefore.textContent = ''; elPivot.textContent = 'paste text below'; elAfter.textContent = '';
      progressBar.style.width = '0%'; statusOverlay.textContent = '';
      contextViewer.classList.remove('visible');
    }
  }

  function stepBack()    { stop(); showWord(idx - 1); }
  function stepForward() { stop(); showWord(idx + 1); }

  // ── Controls ──────────────────────────────────────────────────────────────
  function updateWpm(v) {
    wpm = Math.max(50, Math.min(1000, v));
    document.getElementById('wpm-num').textContent = wpm;
    document.getElementById('wpm-slider').value = wpm;
  }
  function stepWpm(delta) { updateWpm(wpm + delta); }

  function updateSize(v) {
    fontSize = parseInt(v);
    document.getElementById('size-val').textContent = fontSize + ' px';
    const px = fontSize + 'px';
    elBefore.style.fontSize = px; elPivot.style.fontSize = px; elAfter.style.fontSize = px;
  }

  function toggleTheme() {
    isLight = !isLight;
    app.classList.toggle('light', isLight);
    document.body.style.background = isLight ? '#f5f5f2' : '#0a0a0a';
    document.getElementById('theme-btn').textContent = isLight ? 'dark mode' : 'light mode';
  }

  function onTextChange() {
    const raw = document.getElementById('text-input').value;
    words = parseText(raw);
    document.getElementById('word-counter').textContent = words.length + ' words';
    // Reset session tracking whenever new text is loaded
    totalPlayMs    = 0;
    playStartTime  = null;
    wordsReadCount = 0;
    stop(); idx = 0;
    closeEndScreen();
    if (words.length) { showWord(0); }
    else {
      elBefore.textContent = ''; elPivot.textContent = 'paste text below'; elAfter.textContent = '';
      progressBar.style.width = '0%'; statusOverlay.textContent = '';
      contextViewer.classList.remove('visible');
      backBtn.disabled = true; fwdBtn.disabled = true;
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.target === document.getElementById('text-input')) return;
    // Allow Escape to close end screen
    if (e.code === 'Escape' && endScreen.classList.contains('visible')) {
      closeEndScreen(); return;
    }
    if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); stepBack(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); stepForward(); }
    if (e.code === 'ArrowUp')    { e.preventDefault(); stepWpm(10); }
    if (e.code === 'ArrowDown')  { e.preventDefault(); stepWpm(-10); }
  });