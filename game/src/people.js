// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, cross at
// corners, and run away when a car barrels at them or a fist flies. Each one
// is a small figure — torso, head, legs that swing as they walk.
import * as THREE from 'three';
import { range } from './random.js';

const SHIRTS = [0xe8e8e8, 0xd94f3d, 0x3d7ad9, 0xe8c84a, 0x7a9e7e, 0x8a5fc0, 0xe08a4a, 0x4a4a4a];
const PANTS = [0x2a2f36, 0x3d5a80, 0x6b4a2a, 0x4a4a4a];

export function createPedestrianMesh(shirt, pants) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.08;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 1.66;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
  hair.position.y = 1.7;
  group.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), legMat);
  legL.position.set(-0.16, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legL);
  group.add(legR);
  group.userData.legs = [legL, legR];
  return group;
}

export function createPedestrians(scene, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPedestrianMesh(
      SHIRTS[Math.floor(random() * SHIRTS.length)],
      PANTS[Math.floor(random() * PANTS.length)],
    );
    scene.add(mesh);
    // Start on a sidewalk: just off a road line.
    const road = Math.floor(range(random, -3, 3)) * 32;
    const along = range(random, -96, 96);
    const vertical = random() < 0.5;
    peds.push({
      mesh,
      x: vertical ? road + 8 : along,
      z: vertical ? along : road + 8,
      heading: range(random, 0, Math.PI * 2),
      speed: range(random, 1.0, 1.8),
      walkPhase: range(random, 0, Math.PI * 2),
      state: 'walk',
      fleeTimer: 0,
      health: 30,
      vertical,
      dir: random() < 0.5 ? 1 : -1,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, danger) {
  for (const ped of peds) {
    if (ped.health <= 0) {
      // Down: lying flat, fading back up after a while is handled by world.
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
      continue;
    }
    ped.mesh.rotation.x = 0;
    const dx = danger.x - ped.x;
    const dz = danger.z - ped.z;
    const dist = Math.hypot(dx, dz);
    if (danger.active && dist < 9) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
    } else if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(-dx, -dz);
      ped.heading = away;
      ped.x += Math.sin(away) * 4.5 * dt;
      ped.z += Math.cos(away) * 4.5 * dt;
    } else {
      // Stroll along the sidewalk, turning around at the map edge.
      const step = ped.speed * ped.dir * dt;
      if (ped.vertical) {
        ped.z += step;
        ped.heading = ped.dir > 0 ? 0 : Math.PI;
        if (ped.z > 100 || ped.z < -100) ped.dir *= -1;
      } else {
        ped.x += step;
        ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (ped.x > 100 || ped.x < -100) ped.dir *= -1;
      }
    }
    ped.x = Math.max(-108, Math.min(108, ped.x));
    ped.z = Math.max(-108, Math.min(108, ped.z));
    ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 7);
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legs[0].rotation.x = swing;
    ped.mesh.userData.legs[1].rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}
