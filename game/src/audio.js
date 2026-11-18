// Procedural sound: every noise the game makes is synthesised with WebAudio —
// no audio files, no network. Engine hum, police siren, gunshot, pickup blips
// and three tiny radio stations built from note patterns.
import { RADIO_STATIONS } from './config.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// "C4" style names to MIDI numbers.
function note(name) {
  const letter = name[0];
  const sharp = name[1] === '#';
  const octave = Number.parseInt(name.slice(sharp ? 2 : 1), 10);
  return 12 * (octave + 1) + NOTE[letter] + (sharp ? 1 : 0);
}

// 16-step patterns per station: [note, length in steps] pairs, 0 = rest.
const PATTERNS = {
  synthwave: ['A3', 'C4', 'E4', 'A4', 'G4', 'E4', 'C4', 'E4', 'A3', 'C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4'],
  latin: ['E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'E4', 0, 'C4', 'E4', 'G4', 'E4', 'D4', 'C4', 'D4', 0],
  lofi: ['C4', 0, 'E4', 0, 'G4', 0, 'A3', 0, 'F3', 0, 'A3', 0, 'G3', 0, 'E3', 0],
};
const TEMPO = { synthwave: 132, latin: 118, lofi: 84 };

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let radioTimer = null;
  let radioStep = 0;
  let radioFilter = null; // low-pass the radio: raw square waves carry
  // harsh top harmonics straight to the speakers, which reads as TV
  // static ("radio rusak") on laptop/phone speakers. The filter keeps
  // the synthwave character and removes the harsh top end.
  let station = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      // The old master (0.5) with note gains around 0.05 left the radio,
      // the engine and the siren effectively inaudible on laptop speakers.
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function start() {
    if (!ensure()) return;
    // Resume on every gesture, not just at creation: if the context was
    // born suspended (autoplay policy), a later Enter/click must wake it,
    // or the game stays silent even though start() already ran once.
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    // Engine: two detuned saws through a low-pass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55 * 1.005;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
    engineOsc._twin = engineOsc2;
    // Radio bus: one shared low-pass so every radio note is softened.
    radioFilter = ctx.createBiquadFilter();
    radioFilter.type = 'lowpass';
    radioFilter.frequency.value = 1600;
    radioFilter.connect(master);
    // Siren: a triangle that alternates two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    let high = false;
    sirenTimer = window.setInterval(() => {
      if (!sirenOsc) return;
      high = !high;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.02);
    }, 450);
    startRadio();
  }

  function playNote(midi, when, dur, type, gainValue, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainValue, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function startRadio() {
    if (radioTimer) window.clearInterval(radioTimer);
    radioStep = 0;
    radioTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const hue = RADIO_STATIONS[station].hue;
      const pattern = PATTERNS[hue];
      const stepDur = 60 / TEMPO[hue] / 2;
      const name = pattern[radioStep % pattern.length];
      if (name) {
        const midi = note(name);
        // Radio notes go through the low-pass bus; SFX blips (playNote
        // without a dest) stay direct so they keep their snap.
        playNote(midi, ctx.currentTime, stepDur * 1.8, hue === 'lofi' ? 'sine' : 'square', hue === 'lofi' ? 0.16 : 0.12, radioFilter);
        if (radioStep % 4 === 0) playNote(midi - 12, ctx.currentTime, stepDur * 3, 'triangle', 0.12, radioFilter);
      }
      radioStep += 1;
    }, (60 / TEMPO[RADIO_STATIONS[station].hue] / 2) * 1000);
  }

  function setStation(index) {
    station = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    if (started) {
      startRadio();
      // Immediate feedback that the station changed — otherwise R feels
      // dead until the next radio note happens to land.
      blip(660, 0.12, 'sine', 0.18);
    }
    return RADIO_STATIONS[station].name;
  }

  function engine(speed, inCar) {
    if (!ctx || !engineOsc) return;
    const target = inCar ? 0.10 + Math.min(0.18, Math.abs(speed) * 0.004) : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    const f = 50 + Math.abs(speed) * 3.2;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
    if (engineOsc._twin) engineOsc._twin.frequency.setTargetAtTime(f * 1.005, ctx.currentTime, 0.08);
  }

  function siren(on) {
    if (!ctx || !sirenGain) return;
    sirenGain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.2);
  }

  function blip(frequency, dur, type, gainValue) {
    if (!ctx) return;
    playNote(69 + Math.round(12 * Math.log2(frequency / 440)), ctx.currentTime, dur, type, gainValue);
  }

  return {
    start,
    engine,
    siren,
    setStation,
    get station() { return station; },
    pickup() { blip(880, 0.18, 'sine', 0.22); window.setTimeout(() => blip(1320, 0.22, 'sine', 0.20), 90); },
    shot() { blip(220, 0.12, 'square', 0.28); },
    punch() { blip(140, 0.10, 'square', 0.24); },
    crash() { blip(90, 0.25, 'sawtooth', 0.30); },
    mission() { [523, 659, 784].forEach((f, i) => window.setTimeout(() => blip(f, 0.3, 'sine', 0.22), i * 120)); },
    busted() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.35, 'triangle', 0.22), i * 160)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.85;
      return muted;
    },
  };
}
