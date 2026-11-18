// Solmar Bay — sound: engine hum, police siren, three procedural radio
// stations and spot effects, all through WebAudio. The radio stations run
// through one 1600 Hz low-pass bus, so they sound like a car radio, never
// like raw unfiltered oscillators. Audio starts only after a user gesture.

import { RADIOS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let radioBus = null;
  let radioFilter = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let station = 0;
  let stepTimer = 0;
  let stepIndex = 0;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // The radio bus: every station oscillator feeds this one low-pass filter.
    radioFilter = ctx.createBiquadFilter();
    radioFilter.type = 'lowpass';
    radioFilter.frequency.value = 1600;
    radioFilter.Q.value = 0.7;
    radioBus = ctx.createGain();
    radioBus.gain.value = 0.32;
    radioFilter.connect(radioBus);
    radioBus.connect(master);
    // Engine: a quiet sawtooth whose pitch follows the speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: a square wave that alternates two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function note(freq, when, dur, type, gain) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(radioFilter);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function scheduleStep() {
    if (!ctx) return;
    const st = RADIOS[station];
    const beat = 60 / st.bpm / 2;
    const when = ctx.currentTime + 0.08;
    const degree = st.scale[stepIndex % st.scale.length];
    const octave = stepIndex % 8 < 4 ? 1 : 2;
    const freq = st.base * octave * Math.pow(2, degree / 12);
    note(freq, when, beat * 0.9, station === 1 ? 'square' : 'triangle', 0.5);
    if (stepIndex % 2 === 0) {
      note(st.base / 2, when, beat * 1.8, 'sine', 0.6);
    }
    if (stepIndex % 4 === 2) {
      note(st.base * 4, when, beat * 0.4, 'sine', 0.18);
    }
    stepIndex++;
  }

  return {
    get stationName() {
      return RADIOS[station].name;
    },
    get running() {
      return started && ctx !== null;
    },
    // Runtime value of the radio low-pass, for automated checks.
    get radioFilterHz() {
      return radioFilter ? radioFilter.frequency.value : null;
    },
    // Called on the first user gesture, deferred so the title paints first.
    startDeferred() {
      setTimeout(() => start(), 0);
    },
    startNow() {
      start();
    },
    nextStation() {
      station = (station + 1) % RADIOS.length;
      stepIndex = 0;
      return RADIOS[station].name;
    },
    update(dt, speedKmh, wanted) {
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      stepTimer += dt;
      const beat = 60 / RADIOS[station].bpm / 2;
      if (stepTimer >= beat) {
        stepTimer -= beat;
        scheduleStep();
      }
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 55 + Math.abs(speedKmh) * 1.1;
        engineGain.gain.value = speedKmh > 1 ? 0.05 : 0.015;
      }
      if (sirenOsc && sirenGain) {
        if (wanted >= 1) {
          sirenGain.gain.value = 0.035;
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 950 : 720;
          }
        } else {
          sirenGain.gain.value = 0;
        }
      }
    },
    blip(kind) {
      if (!ctx) return;
      const when = ctx.currentTime;
      if (kind === 'pickup') {
        note(660, when, 0.12, 'sine', 0.5);
        note(880, when + 0.1, 0.18, 'sine', 0.5);
      } else if (kind === 'shot') {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 180;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + 0.1);
      } else if (kind === 'crash') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, when);
        osc.frequency.exponentialRampToValueAtTime(40, when + 0.25);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + 0.32);
      }
    },
  };
}
