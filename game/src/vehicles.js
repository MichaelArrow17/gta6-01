// Vehicles: how a car looks, and the traffic that fills the roads. Every car
// is boxes and cylinders in a Group — body, cabin, four wheels, headlights and
// a taillight strip — so a whole street of them costs almost nothing.
// Traffic cars drive rectangular loops around city blocks and turn the corners.
import * as THREE from 'three';
import { range } from './random.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });

export function createCarMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 2.2), paint);
  roof.position.set(0, 1.5, -0.2);
  group.add(roof);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const side of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(side, 0.66, 2.22);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1), tailMat);
  tail.position.set(0, 0.7, -2.22);
  group.add(tail);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  if (kind === 'police') {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), barMat);
    bar.position.set(0, 1.62, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    sign.position.set(0, 1.68, -0.2);
    group.add(sign);
  }
  group.userData.wheels = wheels;
  return group;
}

const TRAFFIC_COLORS = [0xd94f3d, 0x3d7ad9, 0xe8c84a, 0x7a9e7e, 0xd9d9d9, 0x8a5fc0, 0x2a2f36, 0xe08a4a];
const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'sedan', 'truck'];

// A loop is the rectangle of roads around one block: the car drives its
// perimeter, turning a corner each time it reaches one.
export function createTraffic(scene, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    // Block centres sit at 16 mod 32, so bx +/- 16 lands on the roads.
    const centres = [-80, -48, -16, 16, 48, 80];
    const bx = centres[Math.floor(random() * centres.length)];
    const bz = centres[Math.floor(random() * centres.length)];
    const kind = TRAFFIC_KINDS[Math.floor(random() * TRAFFIC_KINDS.length)];
    const color = TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)];
    const mesh = createCarMesh(color, kind);
    scene.add(mesh);
    // Perimeter waypoints (clockwise) around the block centred on (bx, bz).
    const r = 16;
    const corners = [
      [bx - r, bz - r], [bx + r, bz - r], [bx + r, bz + r], [bx - r, bz + r],
    ];
    const startCorner = Math.floor(random() * 4);
    cars.push({
      mesh, kind, color,
      corners, corner: startCorner,
      x: corners[startCorner][0], z: corners[startCorner][1],
      heading: 0, speed: range(random, 7, 11),
      parked: false, health: 100, hitCooldown: 0,
    });
  }
  return cars;
}

function angleTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

export function updateTraffic(cars, dt) {
  for (const car of cars) {
    if (car.parked) continue;
    const target = car.corners[(car.corner + 1) % 4];
    const dx = target[0] - car.x;
    const dz = target[1] - car.z;
    const dist = Math.hypot(dx, dz);
    const want = angleTo(car.x, car.z, target[0], target[1]);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const step = Math.min(dist, car.speed * dt);
    car.x += Math.sin(car.heading) * step;
    car.z += Math.cos(car.heading) * step;
    if (dist < 0.6) car.corner = (car.corner + 1) % 4;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
  }
}

// Parked cars the player can steal: placed along road edges, engines off.
// The last spot sits ahead-right of Rae's spawn (0, 8), in her forward
// view and inside the 6 m steal reach: mission 1 is "steal a car", and
// the old nearest spot was 32 m away, so a new player pressed E at
// nothing and walked the city looking for a car. NOTE: createWorld passes
// count 13, so all 13 spots below are placed — a smaller count silently
// drops the tail of this list, which is how the spawn car went missing.
export function createParkedCars(scene, random, count) {
  const cars = [];
  const spots = [
    [0, -38, 0], [32, 6, 1], [-32, 38, 0], [64, -38, 1], [-64, 6, 0],
    [96, 38, 1], [16, 70, 0], [-48, -70, 1], [48, 70, 0], [-80, -6, 1],
    [80, -70, 0], [-16, -38, 1], [2, 12, 0],
  ];
  for (let i = 0; i < Math.min(count, spots.length); i += 1) {
    const [x, z, along] = spots[i];
    const color = TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)];
    const mesh = createCarMesh(color, 'sedan');
    scene.add(mesh);
    const heading = along === 0 ? 0 : Math.PI / 2;
    const car = {
      mesh, kind: 'sedan', color,
      x, z, heading, speed: 0, parked: true, health: 100, hitCooldown: 0,
      corners: null, corner: 0,
      // Home spot: reset() puts a stolen car back here, so a fresh game
      // always starts with a car by the spawn instead of wherever the
      // last run abandoned it.
      homeX: x, homeZ: z, homeHeading: heading,
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    cars.push(car);
  }
  return cars;
}
