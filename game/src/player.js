// The player: Rae Calloway on foot and behind the wheel. On foot Rae walks
// and runs relative to the camera, punches with F and shoots with a click.
// In a car W/S is throttle and brake, A/D steers, and the car takes damage
// from hard hits. E steals the nearest car or steps out of the one Rae drives.
import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';
import { createPedestrianMesh } from './people.js';

export function createPlayer(scene) {
  const mesh = createPedestrianMesh(0x2a7ad9, 0x2a2f36);
  // Rae's look: a sunset-orange jacket so the player reads at a distance.
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xe8823d });
  scene.add(mesh);
  return {
    mesh,
    x: 0, z: 8, heading: 0, time: 0,
    health: PLAYER.health,
    inCar: null,       // the car object Rae drives, or null
    speed: 0,          // car speed when driving
    ammo: 12,
    punchTimer: 0,
    shootTimer: 0,
    walkPhase: 0,
  };
}

export function collideCircle(colliders, x, z, radius) {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const dx = nx - c.x;
    const dz = nz - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) nx = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else nz = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  }
  return [nx, nz];
}

export function stepOnFoot(player, dt, input, cameraYaw, colliders) {
  const run = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  // WASD moves relative to the camera: W is away from the camera.
  const forward = { x: -Math.sin(cameraYaw), z: -Math.cos(cameraYaw) };
  const right = { x: -forward.z, z: forward.x };
  let mx = forward.x * input.forward + right.x * input.strafe;
  let mz = forward.z * input.forward + right.z * input.strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    player.heading = Math.atan2(mx, mz);
    const nx = player.x + mx * run * dt;
    const nz = player.z + mz * run * dt;
    const [cx, cz] = collideCircle(colliders, nx, nz, PLAYER.radius);
    player.x = Math.max(-126, Math.min(126, cx));
    player.z = Math.max(-126, Math.min(126, cz));
    player.walkPhase += dt * (input.run ? 12 : 8);
    const swing = Math.sin(player.walkPhase) * 0.5;
    player.mesh.userData.legs[0].rotation.x = swing;
    player.mesh.userData.legs[1].rotation.x = -swing;
  } else {
    player.mesh.userData.legs[0].rotation.x = 0;
    player.mesh.userData.legs[1].rotation.x = 0;
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
}

export function stepDriving(player, dt, input, colliders) {
  const car = player.inCar;
  if (!car) return;
  const throttle = input.forward;
  const braking = input.forward < 0;
  if (throttle > 0) player.speed += CAR.accel * dt;
  else if (braking) {
    if (player.speed > 0.5) player.speed -= CAR.brake * dt;
    else player.speed -= CAR.accel * 0.5 * dt;
  } else {
    // Coast down.
    player.speed -= Math.sign(player.speed) * CAR.grip * dt * 0.5;
    if (Math.abs(player.speed) < 0.4) player.speed = 0;
  }
  player.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, player.speed));
  const steerInput = input.strafe;
  const steerAmount = CAR.steer * steerInput * Math.min(1, Math.abs(player.speed) / 8);
  car.heading += steerAmount * dt * Math.sign(player.speed || 1) * (player.speed < 0 ? -1 : 1);
  const nx = car.x + Math.sin(car.heading) * player.speed * dt;
  const nz = car.z + Math.cos(car.heading) * player.speed * dt;
  const [cx, cz] = collideCircle(colliders, nx, nz, CAR.radius);
  const hitWall = cx !== nx || cz !== nz;
  if (hitWall && Math.abs(player.speed) > 6) {
    car.health -= Math.abs(player.speed) * 0.8;
    player.speed *= -0.25;
  } else if (hitWall) {
    player.speed *= 0.4;
  }
  car.x = Math.max(-126, Math.min(126, cx));
  car.z = Math.max(-126, Math.min(126, cz));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += (player.speed * dt) / 0.42;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.mesh.visible = false;
}

// Nearest stealable car within reach (parked cars, or slow traffic).
// Wrecked cars (health 0) are skipped: stealing one used to put Rae in
// and instantly throw her back out with a "car wrecked" toast, which read
// as E doing nothing.
export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (car.health <= 0) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = car;
  car.parked = false;
  car.speed = 0;
  player.speed = 0;
  player.mesh.visible = false;
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  player.speed = 0;
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
}
