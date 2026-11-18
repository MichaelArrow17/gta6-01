// Solmar Bay — Rae Calloway: on-foot movement, driving, carjacking (E),
// punch and pistol, and collision with the city's buildings.

import * as THREE from 'three';
import { CITY, TUNING } from './config.js';
import { makePersonMesh } from './people.js';

function hitSolid(solids, x, z, r) {
  for (const s of solids) {
    if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) return s;
  }
  return null;
}

function pushOut(solids, pos, r) {
  const s = hitSolid(solids, pos.x, pos.z, r);
  if (!s) return;
  const dxl = pos.x + r - s.x0;
  const dxr = s.x1 - (pos.x - r);
  const dzl = pos.z + r - s.z0;
  const dzr = s.z1 - (pos.z - r);
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) pos.x = s.x0 - r;
  else if (m === dxr) pos.x = s.x1 + r;
  else if (m === dzl) pos.z = s.z0 - r;
  else pos.z = s.z1 + r;
}

export function createPlayer(scene, rng, solids) {
  const mesh = makePersonMesh(rng);
  mesh.position.set(CITY.spawn.x, 0, CITY.spawn.z);
  mesh.rotation.y = CITY.spawn.yaw;
  scene.add(mesh);

  const player = {
    mesh,
    x: CITY.spawn.x,
    z: CITY.spawn.z,
    yaw: CITY.spawn.yaw,
    health: TUNING.startHealth,
    cash: TUNING.startCash,
    ammo: TUNING.startAmmo,
    inCar: null,
    carSpeed: 0,
    carYaw: 0,
    speedKmh: 0,
    nearCrate: false,
    get pos() {
      return { x: this.x, z: this.z };
    },
    respawn() {
      this.x = CITY.spawn.x;
      this.z = CITY.spawn.z;
      this.yaw = CITY.spawn.yaw;
      this.health = TUNING.startHealth;
      if (this.inCar) {
        this.inCar.mesh.visible = true;
        this.inCar = null;
      }
      this.carSpeed = 0;
      mesh.position.set(this.x, 0, this.z);
      mesh.rotation.y = this.yaw;
      mesh.visible = true;
    },
    damage(amount, fromX, fromZ) {
      this.health -= amount;
      if (this.health < 0) this.health = 0;
    },
    update(dt, input, world) {
      if (this.inCar) {
        this.updateCar(dt, input, world);
      } else {
        this.updateFoot(dt, input, world);
      }
      this.speedKmh = Math.round(Math.abs(this.carSpeed || this.walkSpeed || 0) * 3.6);
    },
    updateFoot(dt, input, world) {
      const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
      const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
      let fx = 0;
      let fz = 0;
      if (input.keys.has('KeyW')) fz -= 1;
      if (input.keys.has('KeyS')) fz += 1;
      if (input.keys.has('KeyA')) fx -= 1;
      if (input.keys.has('KeyD')) fx += 1;
      if (fx !== 0 || fz !== 0) {
        // Camera-relative movement: W walks away from the camera.
        // Local (nx, nz) rotates by (cameraYaw + PI) into world space.
        const cy = world.cameraYaw;
        const len = Math.hypot(fx, fz);
        const nx = fx / len;
        const nz = fz / len;
        const wx = -nx * Math.cos(cy) - nz * Math.sin(cy);
        const wz = nx * Math.sin(cy) - nz * Math.cos(cy);
        this.x += wx * speed * dt;
        this.z += wz * speed * dt;
        this.yaw = Math.atan2(wx, wz);
        pushOut(solids, this, 0.5);
        this.walkSpeed = speed;
      } else {
        this.walkSpeed = 0;
      }
      mesh.position.set(this.x, 0, this.z);
      mesh.rotation.y = this.yaw;
      // Walk bob, driven by accumulated simulation time (never wall time,
      // so staged re-renders stay pixel-identical).
      this.bobT = (this.bobT || 0) + dt;
      mesh.position.y = this.walkSpeed > 0 ? Math.abs(Math.sin(this.bobT * 11)) * 0.06 : 0;
    },
    updateCar(dt, input, world) {
      const car = this.inCar;
      let throttle = 0;
      if (input.keys.has('KeyW')) throttle += 1;
      if (input.keys.has('KeyS')) throttle -= 1;
      if (throttle > 0) {
        this.carSpeed += TUNING.carAccel * dt;
      } else if (throttle < 0) {
        if (this.carSpeed > 0.5) this.carSpeed -= TUNING.carBrake * dt;
        else this.carSpeed -= TUNING.carReverse * dt * 0.5;
      } else {
        this.carSpeed *= Math.max(0, 1 - dt * 0.8);
      }
      this.carSpeed = THREE.MathUtils.clamp(this.carSpeed, -TUNING.carReverse, TUNING.carMaxSpeed);
      let steer = 0;
      if (input.keys.has('KeyA')) steer += 1;
      if (input.keys.has('KeyD')) steer -= 1;
      const dir = this.carSpeed >= 0 ? 1 : -1;
      this.carYaw += steer * TUNING.carTurn * dt * dir * Math.min(1, Math.abs(this.carSpeed) / 8);
      const nx = this.x + Math.sin(this.carYaw) * this.carSpeed * dt;
      const nz = this.z + Math.cos(this.carYaw) * this.carSpeed * dt;
      const probe = { x: nx, z: nz };
      if (!hitSolid(solids, nx, nz, 1.4)) {
        this.x = nx;
        this.z = nz;
      } else {
        this.carSpeed *= 0.4;
      }
      this.x = THREE.MathUtils.clamp(this.x, -270, 270);
      this.z = THREE.MathUtils.clamp(this.z, -270, 300);
      car.mesh.position.set(this.x, 0, this.z);
      car.mesh.rotation.y = this.carYaw;
      mesh.visible = false;
      this.walkSpeed = this.carSpeed;
    },
    // Steal or enter a car. The steal flag is captured BEFORE the car is
    // entered, so pressing E at spawn enters the car and the job advances.
    tryEnterCar(nearby) {
      if (!nearby) return 'none';
      const stolen = !nearby.owned;
      if (stolen) {
        nearby.taken = true;
        nearby.owned = true;
      }
      this.inCar = nearby;
      this.carYaw = nearby.yaw;
      this.carSpeed = 0;
      this.x = nearby.x;
      this.z = nearby.z;
      nearby.mesh.position.set(this.x, 0, this.z);
      nearby.mesh.rotation.y = this.carYaw;
      this.yaw = this.carYaw;
      return stolen ? 'stolen' : 'entered';
    },
    exitCar() {
      if (!this.inCar) return;
      const car = this.inCar;
      this.inCar = null;
      this.carSpeed = 0;
      this.x = car.x + Math.sin(this.yaw + Math.PI / 2) * 2.4;
      this.z = car.z + Math.cos(this.yaw + Math.PI / 2) * 2.4;
      mesh.position.set(this.x, 0, this.z);
      mesh.visible = true;
    },
    punch(peds, police) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      for (const ped of peds) {
        const dx = ped.x - this.x;
        const dz = ped.z - this.z;
        if (Math.hypot(dx, dz) < TUNING.punchRange && dx * fx + dz * fz > 0) {
          ped.health -= 60;
          return 'hit-ped';
        }
      }
      return 'miss';
    },
    shoot(peds, police) {
      if (this.ammo <= 0) return 'no-ammo';
      this.ammo--;
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      for (const ped of peds) {
        const dx = ped.x - this.x;
        const dz = ped.z - this.z;
        const dist = Math.hypot(dx, dz);
        if (dist < TUNING.shotRange && dx * fx + dz * fz > dist * 0.9) {
          ped.health -= 100;
          return 'hit-ped';
        }
      }
      for (const cop of police.cops) {
        const dx = cop.x - this.x;
        const dz = cop.z - this.z;
        const dist = Math.hypot(dx, dz);
        if (dist < TUNING.shotRange && dx * fx + dz * fz > dist * 0.9) {
          return 'hit-cop';
        }
      }
      return 'shot';
    },
  };
  return player;
}
