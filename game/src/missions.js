// Missions and story: six jobs from Dario Venn and Lena Cross, each a short
// chain of objectives — steal, drive to a marker, collect, survive the heat.
// The module owns the objective list, the timer, the beacon in the world and
// the payout; the world only feeds it the player's position and flags.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissions(scene) {
  // The beacon: a glowing pillar the player drives toward, plus a ring on the ground.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  // Crate pickups for the collect objectives.
  const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x664411 });
  const crateMeshes = [];

  let index = 0;          // which mission is active
  let objective = 0;      // which objective of it
  let timer = 0;          // seconds left on a timed objective (0 = none)
  let active = false;
  let done = false;       // every mission finished

  function current() {
    return MISSIONS[index];
  }
  function currentObjective() {
    const mission = current();
    return mission ? mission.objectives[objective] : null;
  }
  function placeBeacon() {
    const obj = currentObjective();
    if (obj && (obj.type === 'goto' || obj.type === 'collect')) {
      beacon.position.set(obj.x, 0, obj.z);
      beacon.visible = true;
    } else {
      beacon.visible = false;
    }
  }
  function spawnCrates() {
    for (const mesh of crateMeshes) scene.remove(mesh);
    crateMeshes.length = 0;
    const mission = current();
    if (!mission) return;
    for (const obj of mission.objectives) {
      if (obj.type !== 'collect') continue;
      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.position.set(obj.x, 0.9, obj.z);
      scene.add(mesh);
      crateMeshes.push(mesh);
    }
  }

  function start(indexValue) {
    index = indexValue;
    objective = 0;
    active = true;
    done = false;
    const obj = currentObjective();
    timer = obj && obj.timer ? obj.timer : 0;
    spawnCrates();
    placeBeacon();
  }

  function startNext() {
    if (index + 1 >= MISSIONS.length) {
      active = false;
      done = true;
      beacon.visible = false;
      return null;
    }
    start(index + 1);
    return current();
  }

  // flags: { stoleCar, playerX, playerZ, inCar }
  // Returns: 'objective' | 'complete' | 'failed' | null
  function update(dt, flags) {
    if (!active) return null;
    const obj = currentObjective();
    if (!obj) return null;
    if (timer > 0) {
      timer -= dt;
      if (timer <= 0) return 'failed';
    }
    if (obj.type === 'steal') {
      if (flags.stoleCar) {
        objective += 1;
        const next = currentObjective();
        timer = next && next.timer ? next.timer : 0;
        placeBeacon();
        return 'objective';
      }
      return null;
    }
    if (obj.type === 'goto' || obj.type === 'collect') {
      const dist = Math.hypot(flags.playerX - obj.x, flags.playerZ - obj.z);
      if (dist <= obj.radius) {
        if (obj.type === 'collect') {
          const mesh = crateMeshes.find((m) => Math.hypot(m.position.x - obj.x, m.position.z - obj.z) < 0.5);
          if (mesh) scene.remove(mesh);
        }
        objective += 1;
        const next = currentObjective();
        timer = next && next.timer ? next.timer : 0;
        if (!next) return 'complete';
        placeBeacon();
        return 'objective';
      }
      return null;
    }
    if (obj.type === 'evade') {
      if (flags.wanted === 0) {
        objective += 1;
        if (!currentObjective()) return 'complete';
        placeBeacon();
        return 'objective';
      }
      return null;
    }
    return null;
  }

  function updateVisual(dt, time) {
    if (beacon.visible) {
      const s = 1 + Math.sin(time * 3) * 0.08;
      ring.scale.set(s, s, 1);
      pillar.material.opacity = 0.28 + Math.sin(time * 3) * 0.08;
    }
    for (const mesh of crateMeshes) mesh.rotation.y += dt * 0.8;
  }

  return {
    get index() { return index; },
    get active() { return active; },
    get done() { return done; },
    get timer() { return timer; },
    get objectiveIndex() { return objective; },
    current,
    currentObjective,
    start,
    startNext,
    update,
    updateVisual,
    objectiveTarget() {
      const obj = currentObjective();
      return obj && (obj.type === 'goto' || obj.type === 'collect') ? { x: obj.x, z: obj.z } : null;
    },
  };
}
