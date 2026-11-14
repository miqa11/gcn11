(() => {
  "use strict";

  const storageKey = "gaicani_card_sounds";
  let enabled = true;
  try { enabled = localStorage.getItem(storageKey) !== "off"; } catch (_) {}
  let audio;
  let output;
  let paper;
  let lastCue = -Infinity;
  let lastResult = -Infinity;
  const buttons = () => document.querySelectorAll("[data-card-sound-toggle]");

  function paint() {
    for (const button of buttons()) button.setAttribute("aria-pressed", String(enabled));
  }

  // Browsers allow sound only after a user gesture on this page.
  function unlock() {
    if (!enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!audio) {
        audio = new Audio();
        output = audio.createGain();
        output.gain.value = 0.38;
        output.connect(audio.destination);
      }
      if (audio.state === "suspended" || audio.state === "interrupted") audio.resume().catch(() => {});
    } catch (_) {}
  }

  function voice(source, start, duration, level, destination = output) {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (destination !== output) destination.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.004);
  }

  function rustle(start, duration, tone, level) {
    if (!paper) {
      paper = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.16), audio.sampleRate);
      const samples = paper.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = audio.createBufferSource();
    source.buffer = paper;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = tone;
    filter.Q.value = 0.75;
    filter.connect(output);
    voice(source, start, duration, level, filter);
  }

  function note(start, duration, hz, level) {
    const source = audio.createOscillator();
    source.type = "sine";
    source.frequency.value = hz;
    voice(source, start, duration, level);
  }

  function play(kind, count = 1) {
    if (!enabled || audio?.state !== "running" || document.hidden) return;
    const now = audio.currentTime;
    if (kind === "result" ? now - lastResult < 0.26 : now - lastCue < 0.08) return;
    if (kind === "result") lastResult = now;
    else lastCue = now;
    try {
      if (kind === "deal") {
        for (let i = 0; i < Math.min(count, 4); i++) {
          rustle(now + i * 0.041, 0.075, 1650 - i * 90, 0.17);
          note(now + i * 0.041 + 0.037, 0.049, 145, 0.038);
        }
      } else if (kind === "flip") {
        rustle(now + 0.105, 0.063, 2350, 0.18);
      } else if (kind === "collect") {
        rustle(now + 0.025, 0.13, 830, 0.15);
      } else if (kind === "result") {
        for (const [index, pitch] of [392, 494, 587].entries()) note(now + index * 0.075, 0.18, pitch, 0.085);
      } else if (kind === "move") {
        rustle(now, 0.072, 1240, 0.13);
        note(now + 0.033, 0.05, 175, 0.045);
      }
    } catch (_) {}
  }

  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem(storageKey, enabled ? "on" : "off"); } catch (_) {}
    if (audio && output) output.gain.setValueAtTime(enabled ? 0.38 : 0, audio.currentTime);
    paint();
  }

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest?.("[data-card-sound-toggle]")) unlock();
  }, { passive: true });
  document.addEventListener("keydown", () => unlock());
  document.addEventListener("click", event => {
    if (!event.target.closest?.("[data-card-sound-toggle]")) return;
    setEnabled(!enabled);
    if (enabled) unlock();
  });
  document.addEventListener("DOMContentLoaded", paint);
  window.addEventListener("storage", event => {
    if (event.key === storageKey) setEnabled(event.newValue !== "off");
  });
  window.GaicaniCardSound = Object.freeze({ play });
})();
