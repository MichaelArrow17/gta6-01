// Solmar Bay — pedestrians: 26 walkers on the sidewalks who stroll between
// corners and flee when the player threatens them.

import * as THREE from 'three';
import { CITY, TUNING } from './config.js';

const SHIRTS = [0xc05040, 0x4060c0, 0x50a060, 0xd0a030, 0x8040a0, 0xd0d0d0, 0x303840, 0xe07840];

export function makePersonMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick([0xe0b088, 0xc08860, 0x8a5a40, 0xf0c8a0]) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3038 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
    leg.position.set(sx, 0.38, 0);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.16), shirt);
    arm.position.set(sx * 2.4, 1.15, 0);
    group.add(arm);
  }
  group.userData.isPerson = true;
  return group;
}

function sidewalkPoint(rng) {
  // A point on a sidewalk: just off a road centreline.
  const road = rng.pick(CITY.roadAt);
  const along = rng.range(-150, 150);
  if (rng.chance(0.5)) return { x: road + 7, z: along };
  return { x: along, z: road + 7 };
}

export function createCrowd(scene, rng) {
  const peds = [];
  for (let i = 0; i < TUNING.pedCount; i++) {
    const mesh = makePersonMesh(rng);
    const start = sidewalkPoint(rng);
    mesh.position.set(start.x, 0, start.z);
    scene.add(mesh);
    peds.push({
      mesh,
      x: start.x,
      z: start.z,
      target: sidewalkPoint(rng),
      speed: TUNING.pedSpeed * rng.range(0.8, 1.3),
      fleeing: false,
      health: 100,
    });
  }
  return {
    peds,
    update(dt, threat) {
      for (const ped of peds) {
        if (ped.health <= 0) {
          ped.mesh.visible = false;
          continue;
        }
        const dx = threat.x - ped.x;
        const dz = threat.z - ped.z;
        const dist = Math.hypot(dx, dz);
        let tx = ped.target.x;
        let tz = ped.target.z;
        let speed = ped.speed;
        if (threat.active && dist < 14) {
          // Flee directly away from the threat.
          ped.fleeing = true;
          tx = ped.x - dx / (dist || 1) * 20;
          tz = ped.z - dz / (dist || 1) * 20;
          speed = TUNING.pedFleeSpeed;
        } else {
          ped.fleeing = false;
        }
        const mx = tx - ped.x;
        const mz = tz - ped.z;
        const mlen = Math.hypot(mx, mz);
        if (mlen < 1.2) {
          if (!ped.fleeing) ped.target = sidewalkPoint(rng);
          continue;
        }
        const step = Math.min(mlen, speed * dt);
        ped.x += (mx / mlen) * step;
        ped.z += (mz / mlen) * step;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = Math.atan2(mx, mz);
        // Simple walk bob.
        ped.mesh.position.y = Math.abs(Math.sin((ped.x + ped.z) * 2.2)) * 0.05;
      }
    },
  };
}
