// Solmar Bay — the six-job story chain for Dario Venn and Lena Cross.
// Each job is a list of steps; a step completes when the player reaches its
// target, enters a car, waits out a timer, or collects the golden crate.

import * as THREE from 'three';
import { MISSIONS, PALETTE } from './config.js';

function makeBeacon() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.beacon, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  return group;
}

function makeGoldenCrate() {
  const group = new THREE.Group();
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshLambertMaterial({ color: PALETTE.crateGold, emissive: 0x604000 }),
  );
  crate.position.y = 0.8;
  group.add(crate);
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.15, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x8a6420 }),
  );
  lid.position.y = 1.65;
  group.add(lid);
  group.userData.spin = crate;
  return group;
}

export function createMissions(scene) {
  const beacon = makeBeacon();
  beacon.visible = false;
  scene.add(beacon);
  const crate = makeGoldenCrate();
  crate.visible = false;
  scene.add(crate);

  const state = {
    index: 0,
    step: 0,
    timer: 0,
    done: false,
    allDone: false,
    beacon,
    crate,
    get mission() {
      return MISSIONS[this.index];
    },
    get stepDef() {
      return this.mission ? this.mission.steps[this.step] : null;
    },
    get objectiveText() {
      const s = this.stepDef;
      if (this.allDone) return 'All jobs done — Solmar Bay is yours.';
      if (!s) return '';
      if (s.kind === 'timed' && this.timer > 0) {
        return `${s.text} — ${Math.ceil(this.timer)}s left`;
      }
      return s.text;
    },
    get target() {
      const s = this.stepDef;
      return s && s.target ? { x: s.target[0], z: s.target[1] } : null;
    },
    start(index) {
      this.index = index;
      this.step = 0;
      this.timer = 0;
      this.done = false;
      this.allDone = index >= MISSIONS.length;
      this.placeMarkers();
    },
    placeMarkers() {
      const s = this.stepDef;
      const t = this.target;
      beacon.visible = !!t;
      if (t) beacon.position.set(t.x, 0, t.z);
      const showCrate = s && s.kind === 'collect';
      crate.visible = !!showCrate;
      if (showCrate && t) crate.position.set(t.x, 0, t.z);
      if (s && s.kind === 'timed') this.timer = s.seconds;
    },
    advance() {
      this.step++;
      if (this.step >= this.mission.steps.length) {
        this.done = true;
      } else {
        this.placeMarkers();
      }
    },
    completeJob(cash) {
      const reward = this.mission.reward;
      this.index++;
      this.step = 0;
      this.timer = 0;
      this.done = false;
      if (this.index >= MISSIONS.length) {
        this.allDone = true;
        beacon.visible = false;
        crate.visible = false;
      } else {
        this.placeMarkers();
      }
      return cash + reward;
    },
    update(dt, player) {
      if (this.allDone || !this.stepDef) return null;
      const s = this.stepDef;
      if (s.kind === 'timed') {
        this.timer -= dt;
        if (this.timer <= 0) {
          // Out of time: the job fails and restarts at its first step.
          this.step = 0;
          this.placeMarkers();
          return 'failed';
        }
      }
      if (s.kind === 'enter-car') {
        if (player.inCar) {
          this.advance();
          return this.done ? 'job-done' : 'step';
        }
        return null;
      }
      const t = this.target;
      if (!t) return null;
      const dist = Math.hypot(player.x - t.x, player.z - t.z);
      const radius = s.radius || 8;
      if (s.kind === 'pickup') {
        if (dist < radius) {
          // Lena hops in after a short wait.
          this.timer += dt;
          if (this.timer > 2.5) {
            this.advance();
            return this.done ? 'job-done' : 'step';
          }
        } else {
          this.timer = 0;
        }
        return null;
      }
      if (s.kind === 'collect') {
        if (dist < radius && player.nearCrate) {
          this.advance();
          return this.done ? 'job-done' : 'step';
        }
        return null;
      }
      if (dist < radius) {
        this.advance();
        return this.done ? 'job-done' : 'step';
      }
      // Spin the golden crate so it catches the eye.
      if (crate.visible) crate.rotation.y += dt * 1.2;
      return null;
    },
  };
  return state;
}
