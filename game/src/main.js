// Boot and the one loop for "Sunset Heat: Solmar Bay".
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot — the same seed always
// gives the same frame, because the world only ever rolls its seeded dice.
//
// Screens: title → play ⇄ paused, plus busted (caught), wasted (health 0),
// mission-complete, and all-done. Progress (cash, mission, best) saves to
// localStorage under SAVE_KEY; the title screen offers Continue.
import * as THREE from 'three';
import { SAVE_KEY } from './config.js';
import { createWorld, STEP } from './world.js';
import { createInput, EDGE_CONFIRM, EDGE_ENTER, EDGE_MISSION, EDGE_MUTE, EDGE_PAUSE, EDGE_PUNCH, EDGE_RADIO, EDGE_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { stageShot, SCREEN_TITLE } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Cap the pixel ratio at 1.5: at the old cap of 2 a HiDPI laptop rendered
// four times the CSS pixels (plus antialiasing), which was the biggest
// single cause of the lag in live play. The staged shots render at DPR 1,
// so they are unaffected.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const audio = createAudio();
const hud = createHud();
const world = createWorld(scene, seed, audio);
const input = createInput(canvas);

let screen = 'title';
let station = 0;
let cameraYaw = Math.PI; // behind Rae at the start (she faces +z... see below)
let cameraPitch = 0.32;
let cameraDistance = 9;
let cameraPos = new THREE.Vector3(-14, 8, 26);
let cameraLook = new THREE.Vector3(0, 2, 8);
let lastOrbitAt = 0; // when the player last dragged the camera by hand
let heliLift = 0; // how far the look target has risen toward the helicopter

function announce(message) {
  status.textContent = message;
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      missionIndex: world.missionIndex,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage off (private windows): progress lasts this visit only.
  }
}

// --- Camera -----------------------------------------------------------------
// Chase camera: sits behind the player (or the car) at cameraYaw, eases toward
// its spot every frame so turns feel smooth instead of snapping.
function updateCamera(dt) {
  const p = world.player;
  // Follow behind the player in play. The old camera never moved unless
  // the mouse was dragged, so after Rae turned (or the car did) the camera
  // sat beside her and W moved her in a direction that did not match the
  // screen — the WASD complaint. A recent manual drag holds the angle for
  // a moment so looking around still works.
  if (screen === 'play' && performance.now() - lastOrbitAt > 1200) {
    const desired = p.heading + Math.PI;
    let diff = desired - cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // 3.0/s, not 1.8: the old rate left the camera half a second behind
    // after every turn, so W kept moving Rae in a direction that did not
    // match the screen — the "character drifts after changing venues"
    // complaint. 3.0 still eases (no snap) but catches up in ~0.3 s.
    cameraYaw += diff * Math.min(1, dt * 3.0);
  }
  const target = new THREE.Vector3(p.x, 1.6, p.z);
  const back = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const dist = p.inCar ? 11 : 8;
  const height = p.inCar ? 5.2 : 4.2;
  const desired = target.clone().addScaledVector(back, dist);
  desired.y = target.y + height;
  // Helicopter lift: the chase camera looks down steeply, so a helicopter
  // at cruise height sits above the top of the frame and only its beam
  // shows. While wanted >= 3 the look target rises toward the helicopter,
  // tilting the camera up so the airframe comes into view; it eases back
  // down when the heat cools off, so normal driving keeps its road view.
  const wantLift = world.police.wanted >= 3 ? 3.5 : 0;
  heliLift += (wantLift - heliLift) * Math.min(1, dt * 2.5);
  const lookTarget = target.clone();
  lookTarget.y += heliLift;
  cameraPos.lerp(desired, Math.min(1, dt * 5));
  cameraLook.lerp(lookTarget, Math.min(1, dt * 7));
  camera.position.copy(cameraPos);
  camera.lookAt(cameraLook);
}

function syncCameraToPlayer() {
  const p = world.player;
  cameraYaw = p.heading + Math.PI;
  const target = new THREE.Vector3(p.x, 1.6, p.z);
  const back = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  cameraPos.copy(target).addScaledVector(back, p.inCar ? 11 : 8);
  cameraPos.y = target.y + (p.inCar ? 5.2 : 4.2);
  cameraLook.copy(target);
}

// --- Screens ------------------------------------------------------------------
function showScreen(name) {
  screen = name;
  if (name === 'title') {
    hud.show('title-screen');
    const save = readSave();
    document.getElementById('continue-line').textContent = save
      ? `Continue — $${save.cash} saved, job ${save.missionIndex + 1} of 6`
      : 'No save yet — a new story starts at sunset.';
    announce('Sunset Heat: Solmar Bay. Press Enter to start.');
  } else if (name === 'paused') {
    hud.show('pause-screen');
    announce('Paused.');
  } else if (name === 'busted') {
    hud.show('busted-screen');
    announce('Busted. The cops took you in.');
  } else if (name === 'wasted') {
    hud.show('gameover-screen');
    announce('Wasted. Rae is down.');
  } else if (name === 'mission') {
    hud.show('mission-screen');
    announce('Mission complete.');
  } else {
    hud.hideAll();
    announce('Playing.');
  }
}

function startGame(fresh) {
  if (fresh) {
    world.reset();
  } else {
    const save = readSave();
    world.reset();
    if (save) {
      world.state.cash = save.cash || 250;
      world.state.missionIndex = Math.min(5, save.missionIndex || 0);
    }
  }
  world.startMission();
  syncCameraToPlayer();
  showScreen('play');
  hud.toast(`Job ${world.missionIndex + 1}: ${world.missions.current().title} — ${world.missions.current().brief}`);
  // Defer the audio start past the paint: creating the AudioContext can
  // stall 1–3 s on a slow audio device, and run synchronously here it
  // holds the whole task — title, HUD and all — so Enter reads as
  // "macet / buffering". The title hides and paints first; the audio
  // starts a tick later, still inside the user-activation window, and
  // start() resumes the context on every gesture anyway.
  setTimeout(() => audio.start(), 0);
}

function handleEvents(events) {
  for (const event of events) {
    if (event === 'busted') {
      audio.busted();
      world.respawn();
      writeSave();
      showScreen('busted');
    } else if (event === 'wasted') {
      world.respawn();
      writeSave();
      showScreen('wasted');
    } else if (event === 'stole-car') {
      hud.toast('Car stolen! The cops are on to you — ★');
    } else if (event === 'mission-complete') {
      const mission = world.missions.current();
      hud.toast(`Job done: ${mission.title} — +$${mission.reward}`);
      writeSave();
    } else if (event === 'mission-start') {
      const mission = world.missions.current();
      hud.toast(`New job: ${mission.title} — ${mission.brief}`);
    } else if (event === 'all-done') {
      writeSave();
      showScreen('mission');
      document.getElementById('mission-done-line').textContent =
        `All six jobs done. Solmar Bay is yours, Rae. Final take: $${world.cash}.`;
    } else if (event === 'mission-failed') {
      hud.toast('Job failed — the clock ran out. Try it again.');
    } else if (event === 'objective') {
      hud.toast('Objective done — keep going.');
    } else if (event === 'car-wrecked') {
      hud.toast('Your car is wrecked. Find another one.');
    } else if (event === 'crash') {
      hud.toast('You hit traffic — the cops noticed.');
    } else if (event === 'hit-ped' || event === 'punched-ped') {
      hud.toast('That was a civilian! Wanted level up.');
    } else if (typeof event === 'string' && event.startsWith('shop:')) {
      hud.toast(event.slice(5));
    }
  }
}

function stepOnce(edges) {
  const move = input.read();
  const orbit = input.takeOrbit();
  if (orbit.dx !== 0 || orbit.dy !== 0) lastOrbitAt = performance.now();
  if (orbit.dx !== 0) cameraYaw -= orbit.dx * 0.005;
  if (orbit.dy !== 0) cameraPitch = Math.max(0.12, Math.min(0.7, cameraPitch - orbit.dy * 0.002));
  // A click shoots toward the cursor, not just where Rae faces: turn her
  // (on foot) toward the ground point under the click before the step, so
  // the shot in world.step goes where the player aimed.
  if (edges & EDGE_SHOOT && !world.player.inCar) {
    const click = input.lastClick();
    if (click) {
      const ndc = new THREE.Vector2(
        (click.x / window.innerWidth) * 2 - 1,
        -(click.y / window.innerHeight) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(ground, hit)) {
        const p = world.player;
        p.heading = Math.atan2(hit.x - p.x, hit.z - p.z);
        p.mesh.rotation.y = p.heading;
      }
    }
  }
  const edgeObj = {
    enter: !!(edges & EDGE_ENTER),
    punch: !!(edges & EDGE_PUNCH),
    shoot: !!(edges & EDGE_SHOOT),
  };
  // Snap the camera behind Rae when she gets in or out of a car: the
  // heading flips to the car's (or back to hers) in one step, and easing
  // across that jump leaves W steering sideways for a beat — the same
  // drift as #6, worst right after a venue change (car to foot and back).
  const wasInCar = !!world.player.inCar;
  const events = world.step(STEP, move, edgeObj, cameraYaw);
  if (!!world.player.inCar !== wasInCar) syncCameraToPlayer();
  handleEvents(events);
  updateCamera(STEP);
}

// --- Shot mode ------------------------------------------------------------------
function runShot(name) {
  const staged = stageShot(name, world, seed);
  camera.position.set(staged.camPos[0], staged.camPos[1], staged.camPos[2]);
  camera.lookAt(staged.camLook[0], staged.camLook[1], staged.camLook[2]);
  if (staged.screen === SCREEN_TITLE) {
    hud.show('title-screen');
    document.getElementById('continue-line').textContent = 'A complete open world — drive, steal, run, and take Solmar Bay.';
  } else {
    hud.hideAll();
    hud.update(world.hudState(station));
  }
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- Live game --------------------------------------------------------------------
function runGame() {
  let accumulator = 0;
  let last = performance.now();
  showScreen('title');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const edges0 = input.takeEdges();
    let edges = edges0;
    if (screen !== 'play' && screen !== 'title') accumulator = 0;
    // Any key or click is a user gesture: (re)start the audio here too,
    // so a context born suspended still wakes up on the next gesture
    // instead of leaving the game silent. Deferred past the paint for
    // the same reason as in startGame: AudioContext creation can stall
    // the task and make the pressed key feel dead.
    if (edges0 !== 0) setTimeout(() => audio.start(), 0);
    if (edges & EDGE_MUTE) {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off.' : 'Sound on.');
    }
    if (edges & EDGE_RADIO) {
      station = (station + 1) % 3;
      hud.toast(`Radio: ${audio.setStation(station)}`);
    }
    if (screen === 'title' && (edges & EDGE_CONFIRM)) {
      startGame(false);
    } else if (screen === 'busted' || screen === 'wasted') {
      if (edges & EDGE_CONFIRM) {
        world.startMission();
        syncCameraToPlayer();
        showScreen('play');
      }
    } else if (screen === 'mission') {
      if (edges & EDGE_CONFIRM) showScreen('play');
    } else if (screen === 'paused') {
      if (edges & (EDGE_PAUSE | EDGE_CONFIRM)) showScreen('play');
    } else if (screen === 'play') {
      if (edges & EDGE_PAUSE) {
        showScreen('paused');
      } else {
        if (edges & EDGE_MISSION) {
          const mission = world.startMission();
          if (mission) hud.toast(`Job ${world.missionIndex + 1}: ${mission.title} — ${mission.brief}`);
        }
        while (accumulator >= STEP) {
          stepOnce(edges);
          accumulator -= STEP;
          // stepOnce consumes the same edges value; only the first step acts.
          edges = 0;
        }
        hud.update(world.hudState(station));
        renderer.render(scene, camera);
      }
    } else {
      accumulator = 0;
    }
    if (screen === 'title') {
      // The title screen lives: traffic rolls past behind the menu.
      while (accumulator >= STEP) {
        world.step(STEP, { forward: 0, strafe: 0, run: false }, {}, cameraYaw);
        accumulator -= STEP;
      }
      updateCamera(STEP);
      renderer.render(scene, camera);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') showScreen('paused');
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // Re-read the pixel ratio on every resize: when the window moves
    // between displays or the page zoom changes, devicePixelRatio changes
    // but setSize alone keeps the stale ratio, so the drawing buffer no
    // longer matches the display and the resolution visibly fluctuates.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  announce('Sunset Heat: Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
