// All sound is synthesized with WebAudio: no audio files, no network.
// The context is created on the first user gesture; shot mode never touches it.
import { MUTE_KEY } from './config.js';

let ctx = null;
let muted = false;
try {
  muted = window.localStorage.getItem(MUTE_KEY) === '1';
} catch {
  muted = false;
}

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function tone(freq, dur, type, vol, slideTo, when = 0) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol, lowpass = 1200) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

// The turkey's own voice: a quick gobble-gobble.
export function gobble() {
  tone(320, 0.09, 'square', 0.12, 180);
  tone(300, 0.09, 'square', 0.12, 170, 0.1);
  tone(340, 0.12, 'square', 0.12, 200, 0.2);
}

export function jump() {
  tone(280, 0.16, 'sine', 0.16, 620);
}
export function pickup() {
  tone(880, 0.08, 'sine', 0.14);
  tone(1318, 0.12, 'sine', 0.14, undefined, 0.07);
}
export function feather() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.13, undefined, i * 0.06));
}
export function dash() {
  noise(0.18, 0.2, 2600);
  tone(180, 0.2, 'sawtooth', 0.08, 520);
}
export function hit() {
  noise(0.22, 0.3, 900);
  tone(140, 0.25, 'sawtooth', 0.18, 60);
}
export function caught() {
  [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.14, undefined, i * 0.16));
}
export function escaped() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, undefined, i * 0.09));
}

// A cheerful little banjo-ish loop, one bar of eight eighth-notes.
const LEAD = [392, 523, 659, 523, 784, 659, 587, 523];
const BASS = [131, 131, 175, 131, 196, 175, 147, 131];
let musicStep = 0;
let nextStepTime = 0;
export function musicTick(now) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  if (nextStepTime === 0) nextStepTime = ac.currentTime + 0.1;
  while (nextStepTime < ac.currentTime + 0.25) {
    const i = musicStep % 8;
    const when = Math.max(0, nextStepTime - ac.currentTime);
    tone(LEAD[i], 0.16, 'triangle', 0.07, undefined, when);
    tone(BASS[i], 0.22, 'sine', 0.09, undefined, when);
    musicStep += 1;
    nextStepTime += 0.24;
  }
}

export function isMuted() {
  return muted;
}
export function toggleMute() {
  muted = !muted;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage can be off: the mute then lasts this visit only.
  }
  return muted;
}
