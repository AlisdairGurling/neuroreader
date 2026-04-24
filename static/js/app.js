/* ─── NeuroReader — Frontend Application ─── */

(function () {
  "use strict";

  // ─── State ───
  let isPlaying = false;
  let currentBlobUrl = null;
  let alignmentData = null;     // { tokens, sentences } for the current playback
  let wordEls = [];             // DOM refs to word <span>s, indexed by token idx
  let activeTokenIdx = -1;
  let activeSentenceIdx = -1;
  let rafId = null;

  // ─── DOM refs ───
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const root           = document.documentElement;
  const body           = document.body;

  const textInput      = $("#text-input");
  const charCount      = $("#char-count");
  const readTime       = $("#read-time");
  const clearBtn       = $("#clear-btn");
  const speakBtn       = $("#speak-btn");
  const cancelBtn      = $("#cancel-btn");
  const speedSlider    = $("#speed-slider");
  const speedValue     = $("#speed-value");
  const audioArea      = $("#audio-area");
  const audioPlayer    = $("#audio-player");
  const readingPane    = $("#reading-pane");
  const apiBanner      = $("#api-key-banner");

  const statusLine     = $("#status-line");
  const statusLineText = $("#status-line-text");
  const statusDismiss  = $("#status-line-dismiss");

  // PDF
  const pdfDropZone    = $("#pdf-drop-zone");
  const pdfFileInput   = $("#pdf-file-input");
  const pdfPreview     = $("#pdf-preview");
  const pdfFilename    = $("#pdf-filename");
  const pdfText        = $("#pdf-text");
  const pdfRemove      = $("#pdf-remove");
  const pdfSpeakBtn    = $("#pdf-speak-btn");
  const pdfCopyBtn     = $("#pdf-copy-btn");

  // Settings — API / voices / tuning
  const apiKeyInput      = $("#api-key-input");
  const saveKeyBtn       = $("#save-key-btn");
  const voiceSelect      = $("#voice-select");
  const refreshVoices    = $("#refresh-voices");
  const stabilitySlider  = $("#stability-slider");
  const stabilityValue   = $("#stability-value");
  const similaritySlider = $("#similarity-slider");
  const similarityValue  = $("#similarity-value");

  // Settings — reading preferences
  const prefFont       = $("#pref-font");
  const prefSize       = $("#pref-size");
  const prefSizeValue  = $("#pref-size-value");
  const prefLine       = $("#pref-line");
  const prefLineValue  = $("#pref-line-value");
  const prefLetter     = $("#pref-letter");
  const prefLetterValue= $("#pref-letter-value");
  const prefReset      = $("#pref-reset");
  const prefMotion     = $("#pref-motion");
  const prefQuiet      = $("#pref-quiet");
  const prefHighlight  = $("#pref-highlight");

  // ─── Preferences (localStorage) ───
  const PREFS_KEY  = "neuroreader.prefs.v1";
  const DRAFT_KEY  = "neuroreader.draft.v1";
  const TAB_KEY    = "neuroreader.tab.v1";

  const FONT_STACKS = {
    system:       'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    atkinson:     '"Atkinson Hyperlegible", "Atkinson-Hyperlegible", Inter, system-ui, sans-serif',
    opendyslexic: '"OpenDyslexic", "Open-Dyslexic", "Comic Sans MS", sans-serif',
    serif:        'Georgia, "Times New Roman", serif',
    mono:         '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
  };

  const DEFAULT_PREFS = {
    theme: "dark",
    font: "system",
    size: 17,
    line: 1.7,
    letter: 0,
    reduceMotion: false,
    quiet: false,
    highlight: true,
  };

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    } catch (_) {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
  }

  let prefs = loadPrefs();

  function applyPrefs() {
    // Theme
    root.setAttribute("data-theme", prefs.theme);

    // Reading prefs via CSS custom properties
    root.style.setProperty("--reading-font", FONT_STACKS[prefs.font] || FONT_STACKS.system);
    root.style.setProperty("--reading-size", `${prefs.size}px`);
    root.style.setProperty("--reading-line", `${prefs.line}`);
    root.style.setProperty("--reading-letter", `${prefs.letter}em`);

    // Motion
    body.classList.toggle("reduce-motion", !!prefs.reduceMotion);

    // Reflect in settings controls (so toggles stay in sync)
    if (prefFont) prefFont.value = prefs.font;
    if (prefSize) { prefSize.value = prefs.size; prefSizeValue.textContent = `${prefs.size} px`; }
    if (prefLine) { prefLine.value = prefs.line; prefLineValue.textContent = `${Number(prefs.line).toFixed(1)}`; }
    if (prefLetter) { prefLetter.value = prefs.letter; prefLetterValue.textContent = `${Number(prefs.letter).toFixed(2)}`; }
    if (prefMotion) prefMotion.checked = !!prefs.reduceMotion;
    if (prefQuiet) prefQuiet.checked = !!prefs.quiet;
    if (prefHighlight) prefHighlight.checked = !!prefs.highlight;

    // Theme chips radio state
    $$(".theme-chip").forEach((chip) => {
      chip.setAttribute("aria-checked", chip.dataset.theme === prefs.theme ? "true" : "false");
    });
  }

  // ─── Tabs (ARIA + persisted) ───
  function selectTab(name) {
    $$(".tab").forEach((t) => {
      const selected = t.dataset.tab === name;
      t.classList.toggle("active", selected);
      t.setAttribute("aria-selected", selected ? "true" : "false");
      t.setAttribute("tabindex", selected ? "0" : "-1");
    });
    $$(".tab-content").forEach((c) => c.classList.remove("active"));
    const panel = $(`#tab-${name}`);
    if (panel) panel.classList.add("active");
    try { localStorage.setItem(TAB_KEY, name); } catch (_) {}
  }

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });

  // Arrow-key navigation in tablist
  const tablist = document.querySelector('nav[role="tablist"]');
  if (tablist) {
    tablist.addEventListener("keydown", (e) => {
      const tabs = Array.from(tablist.querySelectorAll(".tab"));
      const idx = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      if (idx < 0) return;
      let next = idx;
      if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      selectTab(tabs[next].dataset.tab);
      tabs[next].focus();
    });
  }

  // ─── Notification system (toast OR persistent status line, per Quiet mode) ───
  function notify(message, type = "info") {
    if (prefs.quiet) {
      statusLineText.textContent = message;
      statusLine.classList.remove("hidden", "status-success", "status-error", "status-info");
      statusLine.classList.add(`status-${type}`);
    } else {
      const container = $("#toast-container");
      const el = document.createElement("div");
      el.className = `toast ${type}`;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
  }

  statusDismiss.addEventListener("click", () => {
    statusLine.classList.add("hidden");
    statusLineText.textContent = "";
  });

  // ─── Reading-time estimate ───
  // TTS narration averages ~150 wpm at 1× speed.
  function estimateListenTime(text, speed) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (!words) return "";
    const seconds = (words / 150) * 60 / (speed || 1);
    if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s listen`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `~${m}m ${String(s).padStart(2, "0")}s listen`;
  }

  function updateInputMeta() {
    const len = textInput.value.length;
    charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? "s" : ""}`;
    readTime.textContent = estimateListenTime(textInput.value, parseFloat(speedSlider.value));
    speakBtn.disabled = len === 0;
  }

  // ─── Text input + draft persistence ───
  let draftSaveTimer = null;
  textInput.addEventListener("input", () => {
    updateInputMeta();
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, textInput.value); } catch (_) {}
    }, 400);
  });

  clearBtn.addEventListener("click", () => {
    textInput.value = "";
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    updateInputMeta();
    textInput.focus();
  });

  // ─── Speed ───
  speedSlider.addEventListener("input", () => {
    const v = parseFloat(speedSlider.value);
    speedValue.textContent = `${v.toFixed(1)}×`;
    if (audioPlayer.src) audioPlayer.playbackRate = v;
    updateInputMeta();
  });

  speedSlider.addEventListener("change", async () => {
    const speed = parseFloat(speedSlider.value);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      });
    } catch (_) {}
  });

  // ─── Alignment parsing + reading pane ───
  // Given per-character alignment from ElevenLabs, group characters into
  // tokens (words vs punctuation/whitespace) and sentences. A sentence closes
  // at a non-word token containing `.`, `!`, or `?`.
  function parseAlignment(alignment) {
    const chars = alignment.characters || [];
    const starts = alignment.starts || [];
    const ends = alignment.ends || [];
    if (!chars.length) return { tokens: [], sentences: [] };

    // 1. Group chars into raw tokens
    const raw = [];
    let cur = null;
    const wordChar = /[\p{L}\p{N}]/u;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const isWord = wordChar.test(ch);
      if (!cur || cur.isWord !== isWord) {
        if (cur) raw.push(cur);
        cur = { isWord, text: "", start: starts[i] ?? 0, end: ends[i] ?? 0 };
      }
      cur.text += ch;
      cur.end = ends[i] ?? cur.end;
    }
    if (cur) raw.push(cur);

    // 2. Assign tokens to sentences
    const tokens = [];
    const sentences = [];
    let sentenceIdx = 0;
    let firstTokenIdx = 0;
    let sentenceStart = raw[0]?.start ?? 0;

    for (const rt of raw) {
      tokens.push({
        type: rt.isWord ? "word" : "punct",
        text: rt.text,
        start: rt.start,
        end: rt.end,
        sentenceIdx,
      });
      if (!rt.isWord && /[.!?]/.test(rt.text)) {
        sentences.push({
          idx: sentenceIdx,
          start: sentenceStart,
          end: rt.end,
          firstTokenIdx,
          lastTokenIdx: tokens.length - 1,
        });
        sentenceIdx++;
        firstTokenIdx = tokens.length;
        sentenceStart = rt.end;
      }
    }
    if (tokens.length > firstTokenIdx) {
      sentences.push({
        idx: sentenceIdx,
        start: sentenceStart,
        end: tokens[tokens.length - 1].end,
        firstTokenIdx,
        lastTokenIdx: tokens.length - 1,
      });
    }

    return { tokens, sentences };
  }

  function renderReadingPane({ tokens }) {
    readingPane.innerHTML = "";
    wordEls = [];
    const frag = document.createDocumentFragment();
    tokens.forEach((tok, idx) => {
      const span = document.createElement("span");
      span.textContent = tok.text;
      span.className = tok.type;
      if (tok.type === "word") {
        span.dataset.idx = String(idx);
        span.dataset.start = String(tok.start);
        span.dataset.end = String(tok.end);
        span.addEventListener("click", () => {
          try {
            audioPlayer.currentTime = tok.start + 0.001;
            if (audioPlayer.paused) audioPlayer.play();
          } catch (_) {}
        });
      }
      wordEls[idx] = span;
      frag.appendChild(span);
    });
    readingPane.appendChild(frag);
    readingPane.classList.remove("hidden");
  }

  function clearReadingPane() {
    readingPane.innerHTML = "";
    readingPane.classList.add("hidden");
    wordEls = [];
    alignmentData = null;
    activeTokenIdx = -1;
    activeSentenceIdx = -1;
  }

  function setActiveToken(newIdx) {
    if (newIdx === activeTokenIdx) return;
    if (activeTokenIdx >= 0 && wordEls[activeTokenIdx]) {
      wordEls[activeTokenIdx].classList.remove("reading");
    }
    activeTokenIdx = newIdx;
    if (newIdx < 0) return;
    const el = wordEls[newIdx];
    if (!el) return;
    el.classList.add("reading");

    // Scroll if off-screen within the reading pane
    const paneRect = readingPane.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < paneRect.top + 16 || elRect.bottom > paneRect.bottom - 16) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  function setActiveSentence(newIdx) {
    if (newIdx === activeSentenceIdx || !alignmentData) return;
    if (activeSentenceIdx >= 0) {
      const prev = alignmentData.sentences[activeSentenceIdx];
      if (prev) {
        for (let i = prev.firstTokenIdx; i <= prev.lastTokenIdx; i++) {
          wordEls[i]?.classList.remove("sentence");
        }
      }
    }
    activeSentenceIdx = newIdx;
    if (newIdx < 0) return;
    const s = alignmentData.sentences[newIdx];
    if (!s) return;
    for (let i = s.firstTokenIdx; i <= s.lastTokenIdx; i++) {
      wordEls[i]?.classList.add("sentence");
    }
  }

  function findTokenAt(t, startFrom = 0) {
    if (!alignmentData) return -1;
    const toks = alignmentData.tokens;
    // Linear forward scan from last known position; rewinds when user seeks back
    let i = startFrom;
    if (i < 0 || i >= toks.length || t < toks[i].start) i = 0;
    while (i < toks.length && toks[i].end <= t) i++;
    if (i >= toks.length) return -1;
    // We want word tokens specifically; skip punct
    if (toks[i].type !== "word") {
      // Find nearest following word still within this sentence
      const sIdx = toks[i].sentenceIdx;
      for (let j = i; j < toks.length && toks[j].sentenceIdx === sIdx; j++) {
        if (toks[j].type === "word" && toks[j].start <= t && toks[j].end > t) return j;
      }
      // No word currently active — return -1 so highlight clears briefly
      return -1;
    }
    return i;
  }

  function tick() {
    if (!alignmentData || audioPlayer.paused || audioPlayer.ended) {
      rafId = null;
      return;
    }
    const t = audioPlayer.currentTime;
    const tokIdx = findTokenAt(t, activeTokenIdx >= 0 ? activeTokenIdx : 0);
    if (tokIdx >= 0) {
      setActiveToken(tokIdx);
      setActiveSentence(alignmentData.tokens[tokIdx].sentenceIdx);
    }
    rafId = requestAnimationFrame(tick);
  }

  audioPlayer.addEventListener("play", () => {
    if (alignmentData && rafId === null) rafId = requestAnimationFrame(tick);
  });
  audioPlayer.addEventListener("pause", () => {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  });
  audioPlayer.addEventListener("seeked", () => {
    // User scrubbed — reset scan position to find the new active token
    if (alignmentData) {
      const tokIdx = findTokenAt(audioPlayer.currentTime, 0);
      setActiveToken(tokIdx);
      if (tokIdx >= 0) setActiveSentence(alignmentData.tokens[tokIdx].sentenceIdx);
    }
  });

  // ─── Speak (text) ───
  speakBtn.addEventListener("click", () => speakText(textInput.value));

  async function speakText(text) {
    if (!text.trim()) return;
    stopPlayback();

    const originalLabel = speakBtn.querySelector("span").textContent;
    speakBtn.disabled = true;
    speakBtn.querySelector("span").textContent = prefs.highlight ? "Preparing…" : "Loading…";
    cancelBtn.classList.remove("hidden");

    try {
      if (prefs.highlight) {
        await speakWithHighlight(text.trim());
      } else {
        await speakPlain(text.trim());
      }
      isPlaying = true;
      speakBtn.querySelector("span").textContent = originalLabel;
      speakBtn.disabled = false;
    } catch (e) {
      notify(e.message, "error");
      speakBtn.querySelector("span").textContent = originalLabel;
      speakBtn.disabled = textInput.value.length === 0;
      cancelBtn.classList.add("hidden");
    }
  }

  async function speakPlain(text) {
    const resp = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      let detail = "Speech request failed.";
      try { detail = (await resp.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const blob = await resp.blob();
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = URL.createObjectURL(blob);
    audioPlayer.src = currentBlobUrl;
    audioPlayer.playbackRate = parseFloat(speedSlider.value);
    audioArea.classList.remove("hidden");
    audioPlayer.onended = () => { isPlaying = false; };
    await audioPlayer.play();
  }

  async function speakWithHighlight(text) {
    const resp = await fetch("/api/speak-with-timestamps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      let detail = "Speech request failed.";
      try { detail = (await resp.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const data = await resp.json();
    if (!data.audio_base64) throw new Error("No audio returned.");

    // Decode base64 -> Blob
    const binary = atob(data.audio_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/mpeg" });

    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = URL.createObjectURL(blob);
    audioPlayer.src = currentBlobUrl;
    audioPlayer.playbackRate = parseFloat(speedSlider.value);
    audioArea.classList.remove("hidden");

    alignmentData = parseAlignment(data.alignment || {});
    if (alignmentData.tokens.length) {
      renderReadingPane(alignmentData);
    }

    audioPlayer.onended = () => { isPlaying = false; };
    await audioPlayer.play();
  }

  cancelBtn.addEventListener("click", stopPlayback);

  function stopPlayback() {
    try { audioPlayer.pause(); } catch (_) {}
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
    audioArea.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    clearReadingPane();
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    isPlaying = false;
    speakBtn.disabled = textInput.value.length === 0;
    const spkSpan = speakBtn.querySelector("span");
    if (spkSpan) spkSpan.textContent = "Read Aloud";
    const pdfSpkSpan = pdfSpeakBtn.querySelector("span");
    if (pdfSpkSpan) pdfSpkSpan.textContent = "Read PDF Aloud";
  }

  function rereadCurrentSentence() {
    if (!alignmentData) return;
    const idx = activeSentenceIdx >= 0 ? activeSentenceIdx : 0;
    const s = alignmentData.sentences[idx];
    if (!s) return;
    try {
      audioPlayer.currentTime = s.start + 0.001;
      if (audioPlayer.paused) audioPlayer.play();
    } catch (_) {}
  }

  // ─── PDF Upload ───
  pdfDropZone.addEventListener("click", () => pdfFileInput.click());
  pdfDropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pdfFileInput.click();
    }
  });
  pdfFileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handlePDF(e.target.files[0]);
  });

  pdfDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    pdfDropZone.classList.add("dragover");
  });
  pdfDropZone.addEventListener("dragleave", () => {
    pdfDropZone.classList.remove("dragover");
  });
  pdfDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    pdfDropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith(".pdf")) {
      handlePDF(file);
    } else {
      notify("Please drop a PDF file.", "error");
    }
  });

  async function handlePDF(file) {
    pdfFilename.textContent = file.name;
    pdfDropZone.classList.add("hidden");
    pdfPreview.classList.remove("hidden");
    pdfText.value = "Extracting text…";
    pdfSpeakBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      if (!resp.ok) {
        let detail = "PDF extraction failed.";
        try { detail = (await resp.json()).detail || detail; } catch (_) {}
        throw new Error(detail);
      }
      const data = await resp.json();
      pdfText.value = data.text;
      pdfSpeakBtn.disabled = false;
      notify(`Extracted ${data.char_count.toLocaleString()} characters.`, "success");
    } catch (e) {
      pdfText.value = "";
      notify(e.message, "error");
    }
  }

  pdfRemove.addEventListener("click", () => {
    pdfPreview.classList.add("hidden");
    pdfDropZone.classList.remove("hidden");
    pdfText.value = "";
    pdfFileInput.value = "";
    stopPlayback();
  });

  pdfSpeakBtn.addEventListener("click", () => {
    speakText(pdfText.value);
  });

  pdfCopyBtn.addEventListener("click", () => {
    textInput.value = pdfText.value;
    try { localStorage.setItem(DRAFT_KEY, textInput.value); } catch (_) {}
    updateInputMeta();
    selectTab("read");
    notify("Text copied to Read tab.", "success");
  });

  // ─── Settings: API Key ───
  saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      notify("Please enter an API key.", "error");
      return;
    }
    try {
      const resp = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elevenlabs_api_key: key }),
      });
      if (resp.ok) {
        notify("API key saved.", "success");
        apiKeyInput.value = "";
        apiBanner.classList.add("hidden");
        loadVoices();
      }
    } catch (e) {
      notify("Failed to save API key.", "error");
    }
  });

  // ─── Settings: Voices ───
  async function loadVoices() {
    try {
      const resp = await fetch("/api/voices");
      if (!resp.ok) return;
      const data = await resp.json();
      const configResp = await fetch("/api/config");
      const config = await configResp.json();

      voiceSelect.innerHTML = "";
      data.voices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voice_id;
        opt.textContent = `${v.name} (${v.category})`;
        if (v.voice_id === config.voice_id) opt.selected = true;
        voiceSelect.appendChild(opt);
      });
    } catch (e) {
      voiceSelect.innerHTML = '<option value="">Could not load voices</option>';
    }
  }

  voiceSelect.addEventListener("change", async () => {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceSelect.value }),
    });
    notify("Voice updated.", "success");
  });

  refreshVoices.addEventListener("click", () => {
    notify("Refreshing voices…", "info");
    loadVoices();
  });

  // ─── Settings: Tuning sliders ───
  stabilitySlider.addEventListener("input", () => {
    stabilityValue.textContent = parseFloat(stabilitySlider.value).toFixed(2);
  });
  stabilitySlider.addEventListener("change", () => {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stability: parseFloat(stabilitySlider.value) }),
    });
  });

  similaritySlider.addEventListener("input", () => {
    similarityValue.textContent = parseFloat(similaritySlider.value).toFixed(2);
  });
  similaritySlider.addEventListener("change", () => {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ similarity_boost: parseFloat(similaritySlider.value) }),
    });
  });

  // ─── Settings: Reading preferences ───
  prefFont.addEventListener("change", () => { prefs.font = prefFont.value; savePrefs(); applyPrefs(); });
  prefSize.addEventListener("input", () => { prefs.size = parseInt(prefSize.value, 10); savePrefs(); applyPrefs(); });
  prefLine.addEventListener("input", () => { prefs.line = parseFloat(prefLine.value); savePrefs(); applyPrefs(); });
  prefLetter.addEventListener("input", () => { prefs.letter = parseFloat(prefLetter.value); savePrefs(); applyPrefs(); });

  prefReset.addEventListener("click", () => {
    prefs = { ...prefs, font: DEFAULT_PREFS.font, size: DEFAULT_PREFS.size, line: DEFAULT_PREFS.line, letter: DEFAULT_PREFS.letter };
    savePrefs();
    applyPrefs();
    notify("Reading preferences reset.", "info");
  });

  // ─── Settings: Appearance (theme chips) ───
  $$(".theme-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      prefs.theme = chip.dataset.theme;
      savePrefs();
      applyPrefs();
    });
  });

  // ─── Settings: Comfort ───
  prefMotion.addEventListener("change", () => {
    prefs.reduceMotion = prefMotion.checked;
    savePrefs();
    applyPrefs();
  });

  prefQuiet.addEventListener("change", () => {
    prefs.quiet = prefQuiet.checked;
    savePrefs();
    // If switching to loud while a status line is shown, leave it dismissable
    if (!prefs.quiet) statusLine.classList.add("hidden");
  });

  prefHighlight.addEventListener("change", () => {
    prefs.highlight = prefHighlight.checked;
    savePrefs();
  });

  // ─── Global keyboard shortcuts ───
  document.addEventListener("keydown", (e) => {
    // Cmd/Ctrl + Enter: read the text in focus context
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      const activeTab = document.querySelector(".tab[aria-selected='true']")?.dataset.tab;
      if (activeTab === "pdf" && pdfText.value.trim()) {
        speakText(pdfText.value);
      } else if (textInput.value.trim()) {
        speakText(textInput.value);
      }
    }
    // Esc: cancel current playback
    if (e.key === "Escape" && (isPlaying || !audioArea.classList.contains("hidden"))) {
      stopPlayback();
    }
    // R: re-read current sentence (only when audio is active and focus isn't in an input)
    if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target;
      const inField = t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable);
      if (!inField && alignmentData && !audioArea.classList.contains("hidden")) {
        e.preventDefault();
        rereadCurrentSentence();
      }
    }
  });

  // ─── Init ───
  async function init() {
    applyPrefs();

    // Restore draft
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) textInput.value = draft;
    } catch (_) {}
    updateInputMeta();

    // Restore last tab
    try {
      const lastTab = localStorage.getItem(TAB_KEY);
      if (lastTab && $(`#tab-${lastTab}`)) selectTab(lastTab);
    } catch (_) {}

    try {
      const resp = await fetch("/api/config");
      const config = await resp.json();

      if (!config.has_key) {
        apiBanner.classList.remove("hidden");
      } else {
        loadVoices();
      }

      speedSlider.value = config.speed || 1.0;
      speedValue.textContent = `${parseFloat(speedSlider.value).toFixed(1)}×`;
      stabilitySlider.value = config.stability ?? 0.5;
      stabilityValue.textContent = parseFloat(stabilitySlider.value).toFixed(2);
      similaritySlider.value = config.similarity_boost ?? 0.75;
      similarityValue.textContent = parseFloat(similaritySlider.value).toFixed(2);
      updateInputMeta();
    } catch (e) {
      notify("Could not connect to NeuroReader server.", "error");
    }
  }

  init();
})();
