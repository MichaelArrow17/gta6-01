// Solmar Bay — boot, the game loop, the chase camera, the screens, and the
// staged-shot mode. The title paints first; audio only starts after a user
// gesture, deferred, so Enter answers immediately.

import * as THREE from 'three';
import { CITY, TUNING } from './config.js';
import { createWorld } from './world.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { runShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10);
const shotMode = !!shotName;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 42, 70);
camera.lookAt(-90, 16, -30);

const world = createWorld(scene, seed);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
world.input = input;

let state = 'title';
let orbitYaw = 0;
const camPos = new THREE.Vector3(150, 42, 70);
const camLook = new THREE.Vector3(-90, 16, -30);
let cinematic = null;

// A small handle for automated checks (state, audio graph, police).
window.__solmar = { world, audio, input, get state() { return state; } };

function desiredCamera(distOverride, sideOffset) {
  const p = world.player;
  const yaw = p.inCar ? p.carYaw : p.yaw;
  const back = yaw + Math.PI + orbitYaw;
  const dist = distOverride || (p.inCar ? 12 : 9.5);
  const side = sideOffset || 0;
  const height = (p.inCar ? 5 : 4.2) + (world.police.wanted >= 3 ? TUNING.cameraLiftWanted : 0);
  return {
    // A lateral offset slides the camera sideways while still looking at
    // the player, so a streetlight never sits dead-centre in a staged shot.
    pos: new THREE.Vector3(
      p.x + Math.sin(back) * dist + Math.cos(back) * side,
      height,
      p.z + Math.cos(back) * dist - Math.sin(back) * side,
    ),
    look: new THREE.Vector3(p.x, 1.6, p.z),
  };
}

function snapCamera(distOverride, sideOffset) {
  if (cinematic) {
    camPos.copy(cinematic.pos);
    camLook.copy(cinematic.look);
    return;
  }
  const d = desiredCamera(distOverride, sideOffset);
  camPos.copy(d.pos);
  camLook.copy(d.look);
}

function updateCamera(dt, snap) {
  if (cinematic) {
    camPos.copy(cinematic.pos);
    camLook.copy(cinematic.look);
    return;
  }
  const d = desiredCamera();
  if (snap) {
    camPos.copy(d.pos);
    camLook.copy(d.look);
  } else {
    const k = 1 - Math.exp(-TUNING.cameraFollow * dt);
    camPos.lerp(d.pos, k);
    camLook.lerp(d.look, k);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  const fwd = new THREE.Vector3().subVectors(camLook, camPos);
  world.cameraYaw = Math.atan2(fwd.x, fwd.z);
}

function renderOnce() {
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  renderer.render(scene, camera);
}

function showTitle() {
  hud.show('title-screen');
}
function hideTitle() {
  hud.hide('title-screen');
}
function showHud() {
  hud.show('hud');
}
function hideHud() {
  hud.hide('hud');
}

function startGame() {
  if (state !== 'title') return;
  state = 'playing';
  hideTitle();
  showHud();
  world.running = true;
  world.missions.start(world.missions.index);
  // Audio starts after the gesture, deferred, so the title hides at once.
  audio.startDeferred();
}

function continueFromPanel() {
  hud.hide('busted-screen');
  hud.hide('wasted-screen');
  hud.hide('mission-screen');
  state = 'playing';
  world.paused = false;
  world.running = true;
}

function handleEvents() {
  for (const ev of world.events) {
    if (ev === 'busted') {
      state = 'busted';
      world.paused = true;
      hud.show('busted-screen');
    } else if (ev === 'wasted') {
      state = 'wasted';
      world.paused = true;
      hud.show('wasted-screen');
    } else if (ev === 'job-done') {
      if (world.missions.allDone) {
        document.getElementById('mission-done-text').textContent = 'All six jobs done — Solmar Bay is yours, Rae.';
      } else {
        document.getElementById('mission-done-text').textContent =
          `Job done. Next up: ${world.missions.mission.title}.`;
      }
      state = 'jobdone';
      world.paused = true;
      hud.show('mission-screen');
      audio.blip('pickup');
    } else if (ev === 'stole-car' || ev === 'entered-car') {
      // The camera snaps to the new seat so the framing stays exact.
      snapCamera();
    } else if (ev === 'collect-crate') {
      audio.blip('pickup');
    }
  }
  world.events.length = 0;
}

function handleKeys() {
  if (input.consumePressed('Enter')) {
    if (state === 'title') startGame();
    else if (state === 'busted' || state === 'wasted' || state === 'jobdone') continueFromPanel();
  }
  if (input.consumePressed('KeyE') && state === 'playing') {
    world.pressE();
    snapCamera();
  }
  if (input.consumePressed('KeyF') && state === 'playing') world.pressF();
  if (input.consumePressed('KeyG') && state === 'playing') {
    world.pressG();
    audio.blip('shot');
  }
  if (input.consumePressed('KeyM') && state === 'playing') audio.nextStation();
  if ((input.consumePressed('KeyP') || input.consumePressed('Escape')) && state === 'playing') {
    state = 'paused';
    world.paused = true;
    hud.show('pause-screen');
  } else if ((input.consumePressed('KeyP') || input.consumePressed('Escape')) && state === 'paused') {
    state = 'playing';
    world.paused = false;
    hud.hide('pause-screen');
  }
  const orbit = input.consumeOrbit();
  if (orbit.dx !== 0) orbitYaw += orbit.dx * 0.005;
  orbitYaw = THREE.MathUtils.clamp(orbitYaw, -1.2, 1.2);
  input.clearPressed();
}

// Clicks land on the title panel, which covers the canvas, so listen on the
// window: click starts the game from the title, fires the pistol in play.
window.addEventListener('click', () => {
  if (state === 'title') {
    startGame();
  } else if (state === 'playing') {
    world.pressG();
    audio.blip('shot');
  } else if (state === 'busted' || state === 'wasted' || state === 'jobdone') {
    continueFromPanel();
  }
});

window.addEventListener('resize', () => {
  // Re-apply the pixel ratio on resize so the resolution never fluctuates.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const game = {
  world,
  input,
  snapCamera,
  renderOnce,
  showHud,
  hideHud,
  showTitle,
  hideTitle,
  setCinematic(pos, look) {
    cinematic = { pos, look };
  },
};

if (shotMode) {
  // Staged mode: no save, no audio, no live loop — the shot stages itself.
  hud.hide('hud');
  runShot(shotName, seed, game);
  // Refresh the HUD DOM from the staged world state (the live loop that
  // normally does this does not run in shot mode).
  hud.update(world, audio.stationName);
  renderOnce();
} else {
  const hadSave = world.loadSave();
  if (!hadSave) world.missions.start(0);
  else world.missions.start(world.missions.index);
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    handleKeys();
    handleEvents();
    world.step(dt);
    updateCamera(dt, false);
    audio.update(dt, world.player.speedKmh, world.police.wanted);
    if (state !== 'title') hud.update(world, audio.stationName);
    renderOnce();
  }
  requestAnimationFrame(loop);
}
