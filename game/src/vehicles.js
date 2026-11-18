// Solmar Bay — vehicles: car meshes, the 14-car traffic loops and the 13 parked
// cars by the spawn point. Cars are built from boxes so the whole fleet stays
// cheap to render and deterministic to place.

import * as THREE from 'three';
import { CITY, PALETTE, TUNING } from './config.js';

export function makeCarMesh(color, isCop = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2836, emissive: 0x0a1420 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181818 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.18, -0.25);
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.18, 1.1), paint);
  hood.position.set(0, 0.98, 1.55);
  group.add(hood);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }

  if (isCop) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.52, -0.25);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.2, 4.32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.14, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  head.position.set(0, 0.72, 2.16);
  group.add(head);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.14, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc02020 }),
  );
  tail.position.set(0, 0.72, -2.16);
  group.add(tail);

  group.userData.isCar = true;
  return group;
}

// A rectangular loop around one block: waypoints on the road centrelines.
function blockLoop(rng, ix, iz) {
  const x0 = CITY.roadAt[ix];
  const x1 = CITY.roadAt[ix + 1];
  const z0 = CITY.roadAt[iz];
  const z1 = CITY.roadAt[iz + 1];
  const pts = [
    [x0, z0], [x1, z0], [x1, z1], [x0, z1],
  ];
  if (rng.chance(0.5)) pts.reverse();
  return pts;
}

export function createTraffic(scene, rng) {
  const cars = [];
  const used = new Set();
  for (let i = 0; i < TUNING.trafficCount; i++) {
    let ix = rng.int(0, CITY.roadAt.length - 2);
    let iz = rng.int(0, CITY.roadAt.length - 2);
    let guard = 0;
    while (used.has(ix + ',' + iz) && guard++ < 20) {
      ix = rng.int(0, CITY.roadAt.length - 2);
      iz = rng.int(0, CITY.roadAt.length - 2);
    }
    used.add(ix + ',' + iz);
    const path = blockLoop(rng, ix, iz);
    const mesh = makeCarMesh(rng.pick(PALETTE.carColors));
    scene.add(mesh);
    cars.push({
      mesh,
      path,
      seg: rng.int(0, 3),
      t: rng.next(),
      speed: TUNING.trafficSpeed * rng.range(0.85, 1.15),
      lane: rng.pick([-2.4, 2.4]),
    });
  }
  return {
    cars,
    update(dt) {
      for (const car of cars) {
        const a = car.path[car.seg];
        const b = car.path[(car.seg + 1) % car.path.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len = Math.hypot(dx, dz) || 1;
        car.t += (car.speed * dt) / len;
        if (car.t >= 1) {
          car.t -= 1;
          car.seg = (car.seg + 1) % car.path.length;
        }
        const nx = a[0] + dx * car.t;
        const nz = a[1] + dz * car.t;
        // Lane offset: right-hand side of the direction of travel.
        const ox = (-dz / len) * car.lane;
        const oz = (dx / len) * car.lane;
        car.mesh.position.set(nx + ox, 0, nz + oz);
        car.mesh.rotation.y = Math.atan2(dx, dz);
      }
    },
  };
}

export function createParkedCars(scene, rng, spots) {
  const cars = spots.map((spot) => {
    const mesh = makeCarMesh(rng.pick(PALETTE.carColors));
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.yaw;
    scene.add(mesh);
    return { mesh, x: spot.x, z: spot.z, yaw: spot.yaw, taken: false };
  });
  return cars;
}
