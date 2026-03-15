/* ─── NeuroReader — Frontend Application ─── */

(function () {
  "use strict";

  // ─── State ───
  let currentAudio = null;
  let isPlaying = false;

  // ─── DOM refs ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const textInput    = $("#text-input");
  const charCount    = $("#char-count");
  const clearBtn     = $("#clear-btn");
  const speakBtn     = $("#speak-btn");
  const stopBtn      = $("#stop-btn");
  const speedSlider  = $("#speed-slider");
  const speedValue   = $("#speed-value");
  const audioPlayer  = $("#audio-player");
  const apiBanner    = $("#api-key-banner");

  // PDF
  const pdfDropZone  = $("#pdf-drop-zone");
  const pdfFileInput = $("#pdf-file-input");
  const pdfPreview   = $("#pdf-preview");
  const pdfFilename  = $("#pdf-filename");
  const pdfText      = $("#pdf-text");
  const pdfRemove    = $("#pdf-remove");
  const pdfSpeakBtn  = $("#pdf-speak-btn");
  const pdfStopBtn   = $("#pdf-stop-btn");
  const pdfCopyBtn   = $("#pdf-copy-btn");

  // Settings
  const apiKeyInput     = $("#api-key-input");
  const saveKeyBtn      = $("#save-key-btn");
  const voiceSelect     = $("#voice-select");
  const refreshVoices   = $("#refresh-voices");
  const stabilitySlider = $("#stability-slider");
  const stabilityValue  = $("#stability-value");
  const similaritySlider = $("#similarity-slider");
  const similarityValue  = $("#similarity-value");

  // ─── Tabs ───
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      $(`#tab-${tab.dataset.tab}`).classList.add("active");
    });
  });

  // ─── Toast system ───
  function toast(message, type = "info") {
    const container = $("#toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ─── Text input ───
  textInput.addEventListener("input", () => {
    const len = textInput.value.length;
    charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? "s" : ""}`;
    speakBtn.disabled = len === 0;
  });

  clearBtn.addEventListener("click", () => {
    textInput.value = "";
    textInput.dispatchEvent(new Event("input"));
    textInput.focus();
  });

  // ─── Speed ───
  speedSlider.addEventListener("input", () => {
    speedValue.textContent = `${parseFloat(speedSlider.value).toFixed(1)}×`;
  });

  // ─── Speak (text) ───
  speakBtn.addEventListener("click", () => speakText(textInput.value));

  async function speakText(text) {
    if (!text.trim()) return;
    stopPlayback();

    speakBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    isPlaying = true;

    try {
      const resp = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Speech request failed.");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      audioPlayer.src = url;
      audioPlayer.playbackRate = parseFloat(speedSlider.value);
      audioPlayer.play();

      audioPlayer.onended = () => {
        stopPlayback();
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      toast(e.message, "error");
      stopPlayback();
    }
  }

  stopBtn.addEventListener("click", stopPlayback);

  function stopPlayback() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    speakBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    pdfSpeakBtn.classList.remove("hidden");
    pdfStopBtn.classList.add("hidden");
  }

  // ─── PDF Upload ───
  pdfDropZone.addEventListener("click", () => pdfFileInput.click());
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
      toast("Please drop a PDF file.", "error");
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
        const err = await resp.json();
        throw new Error(err.detail || "PDF extraction failed.");
      }
      const data = await resp.json();
      pdfText.value = data.text;
      pdfSpeakBtn.disabled = false;
      toast(`Extracted ${data.char_count.toLocaleString()} characters.`, "success");
    } catch (e) {
      pdfText.value = "";
      toast(e.message, "error");
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
    pdfSpeakBtn.classList.add("hidden");
    pdfStopBtn.classList.remove("hidden");
    speakText(pdfText.value);
  });

  pdfStopBtn.addEventListener("click", stopPlayback);

  pdfCopyBtn.addEventListener("click", () => {
    textInput.value = pdfText.value;
    textInput.dispatchEvent(new Event("input"));
    // Switch to Read tab
    $$(".tab")[0].click();
    toast("Text copied to Read tab.", "success");
  });

  // ─── Settings: API Key ───
  saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      toast("Please enter an API key.", "error");
      return;
    }

    try {
      const resp = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elevenlabs_api_key: key }),
      });
      if (resp.ok) {
        toast("API key saved.", "success");
        apiKeyInput.value = "";
        apiBanner.classList.add("hidden");
        loadVoices();
      }
    } catch (e) {
      toast("Failed to save API key.", "error");
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
    toast("Voice updated.", "success");
  });

  refreshVoices.addEventListener("click", () => {
    toast("Refreshing voices…", "info");
    loadVoices();
  });

  // ─── Settings: Sliders ───
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

  // ─── Speed slider syncs to playback ───
  speedSlider.addEventListener("change", async () => {
    const speed = parseFloat(speedSlider.value);
    audioPlayer.playbackRate = speed;
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed }),
    });
  });

  // ─── Keyboard shortcut: Cmd+Enter to speak ───
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (textInput.value.trim()) speakText(textInput.value);
    }
    if (e.key === "Escape" && isPlaying) {
      stopPlayback();
    }
  });

  // ─── Init ───
  async function init() {
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
      stabilitySlider.value = config.stability || 0.5;
      stabilityValue.textContent = parseFloat(stabilitySlider.value).toFixed(2);
      similaritySlider.value = config.similarity_boost || 0.75;
      similarityValue.textContent = parseFloat(similaritySlider.value).toFixed(2);
    } catch (e) {
      toast("Could not connect to NeuroReader server.", "error");
    }
  }

  init();
})();
