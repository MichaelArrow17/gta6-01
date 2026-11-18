// Solmar Bay — the law: wanted stars, pursuing cop cars, the helicopter that
// shows up at 3 stars, and the bust that ends a run.

import * as THREE from 'three';
import { PALETTE, TUNING } from './config.js';
import { makeCarMesh } from './vehicles.js';

export function makeHeliMesh() {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: PALETTE.heliColor });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2836 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.2), paint);
  body.position.y = 0;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), glass);
  nose.position.set(0, 0.1, 2.6);
  nose.scale.set(1, 0.8, 1.2);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), paint);
  tail.position.set(0, 0.3, -4.2);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.2), paint);
  fin.position.set(0, 0.9, -6.2);
  group.add(fin);
  const skids = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 3.6), paint);
  skids.position.y = -1.1;
  group.add(skids);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.1;
  group.add(rotor);
  group.userData.rotor = rotor;
  // Searchlight cone under the nose.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 9, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.set(0, -5.4, 1.2);
  beam.rotation.x = Math.PI;
  group.add(beam);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, -9.6, 1.2);
  group.add(spot);
  return group;
}

export function createPolice(scene, rng) {
  const cops = [];
  const heli = makeHeliMesh();
  heli.visible = false;
  scene.add(heli);
  let heliAngle = 0;

  return {
    wanted: 0,
    cops,
    heli,
    decayTimer: 0,
    bustTimer: 0,
    setWanted(n) {
      this.wanted = Math.max(0, Math.min(5, n));
      this.decayTimer = 0;
    },
    addWanted(n) {
      this.setWanted(this.wanted + n);
    },
    spawnCopNear(x, z) {
      const mesh = makeCarMesh(PALETTE.copColor, true);
      const angle = rng.next() * Math.PI * 2;
      mesh.position.set(x + Math.cos(angle) * 70, 0, z + Math.sin(angle) * 70);
      scene.add(mesh);
      const cop = { mesh, x: mesh.position.x, z: mesh.position.z, speed: 0 };
      cops.push(cop);
      return cop;
    },
    update(dt, player, solids) {
      const targetCount = this.wanted === 0 ? 0 : this.wanted <= 2 ? 2 : this.wanted <= 4 ? 3 : 4;
      while (cops.length < targetCount) this.spawnCopNear(player.x, player.z);
      while (cops.length > targetCount) {
        const cop = cops.pop();
        scene.remove(cop.mesh);
      }
      let nearest = Infinity;
      for (const cop of cops) {
        const dx = player.x - cop.x;
        const dz = player.z - cop.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        const speed = dist < 8 ? TUNING.copRamSpeed : TUNING.copSpeed;
        cop.speed += (speed - cop.speed) * Math.min(1, dt * 2);
        const step = cop.speed * dt;
        const nx = cop.x + (dx / (dist || 1)) * step;
        const nz = cop.z + (dz / (dist || 1)) * step;
        cop.x = nx;
        cop.z = nz;
        cop.mesh.position.set(nx, 0, nz);
        cop.mesh.rotation.y = Math.atan2(dx, dz);
        if (dist < 3.2 && !player.inCar) {
          this.bustTimer += dt;
        } else if (dist < 3.4 && player.inCar) {
          // Ram: shove the player car and hurt it.
          player.damage(6 * dt, cop.x, cop.z);
        }
      }
      if (this.wanted > 0 && nearest > 50) {
        this.decayTimer += dt;
        if (this.decayTimer > TUNING.wantedDecaySeconds) {
          this.setWanted(this.wanted - 1);
        }
      } else {
        this.decayTimer = 0;
      }
      // Helicopter: cruises at 12 m over the player once wanted hits 3.
      if (this.wanted >= 3) {
        heli.visible = true;
        heliAngle += dt * 0.45;
        const hx = player.x + Math.cos(heliAngle) * TUNING.heliOrbit;
        const hz = player.z + Math.sin(heliAngle) * TUNING.heliOrbit;
        heli.position.set(hx, TUNING.heliHeight, hz);
        heli.rotation.y = Math.atan2(player.x - hx, player.z - hz);
        heli.userData.rotor.rotation.y += dt * 14;
      } else {
        heli.visible = false;
      }
      if (this.bustTimer > 1.2) {
        this.bustTimer = 0;
        return 'busted';
      }
      return null;
    },
  };
}
