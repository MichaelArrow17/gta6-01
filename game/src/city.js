// Solmar Bay — the city itself: sunset sky, grid roads, buildings, park, beach,
// ocean, pier and lighthouse, docks, palms and streetlights. Everything is built
// from a seeded RNG so the same seed always rebuilds the same city.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function windowTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // A light warm wall so the tinted material stays readable at sunset;
  // lit windows glow, dark ones read as glass.
  ctx.fillStyle = '#b8a890';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rng.chance(0.42);
      ctx.fillStyle = lit ? '#ffd27a' : '#3a3230';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBuilding(rng, winTex, x, z, w, d, h) {
  const tex = winTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 22)));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const color = rng.pick(PALETTE.building);
  const mat = new THREE.MeshLambertMaterial({
    color,
    map: tex,
    // Warm, low emissive so the sunset read stays calm at every resize.
    emissive: 0x201409,
    emissiveIntensity: 0.55,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h / 2, z);
  mesh.userData.solid = { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
  return mesh;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = rng.range(-0.12, 0.12);
  group.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 4), frondMat);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.1, 5.6, Math.sin(angle) * 1.1);
    frond.rotation.z = Math.cos(angle) * 1.1;
    frond.rotation.x = -Math.sin(angle) * 1.1;
    frond.scale.set(1, 1, 0.25);
    group.add(frond);
  }
  return group;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const solids = [];

  // Sky dome: vertex-coloured gradient, deep blue up top to sunset orange low.
  const skyGeo = new THREE.SphereGeometry(430, 24, 16);
  const skyPos = skyGeo.attributes.position;
  const skyColors = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  for (let i = 0; i < skyPos.count; i++) {
    const t = THREE.MathUtils.clamp(skyPos.getY(i) / 430, 0, 1);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.7));
    skyColors[i * 3] = c.r;
    skyColors[i * 3 + 1] = c.g;
    skyColors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  group.add(sky);

  // Low sun disc on the western horizon.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-330, 42, -120);
  sun.lookAt(0, 20, 0);
  group.add(sun);

  scene.fog = new THREE.Fog(PALETTE.fog, 130, 430);
  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.95);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36a, 1.5);
  sunLight.position.set(-120, 70, -60);
  scene.add(sunLight);

  // Ground, roads, park lawn, sand and ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, CITY.groundSize),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  for (const c of CITY.roadAt) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY.groundSize), roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(c, 0.02, 0);
    group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY.groundSize, 10), roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(0, 0.02, c);
    group.add(rz);
    // Centre dashes along both roads.
    for (let d = -260; d <= 260; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, c);
      group.add(dash2);
    }
  }

  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.park.x1 - CITY.park.x0, CITY.park.z1 - CITY.park.z0),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set((CITY.park.x0 + CITY.park.x1) / 2, 0.03, (CITY.park.z0 + CITY.park.z1) / 2);
  group.add(park);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, (CITY.beachZ + CITY.oceanZ) / 2 - 4);
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, CITY.oceanZ + 160);
  group.add(ocean);

  // Buildings, one or two per block, skipping the park block.
  const winTex = windowTexture(rng);
  for (let ix = 0; ix < CITY.roadAt.length - 1; ix++) {
    for (let iz = 0; iz < CITY.roadAt.length - 1; iz++) {
      const x0 = CITY.roadAt[ix] + CITY.roadHalf + 2;
      const x1 = CITY.roadAt[ix + 1] - CITY.roadHalf - 2;
      const z0 = CITY.roadAt[iz] + CITY.roadHalf + 2;
      const z1 = CITY.roadAt[iz + 1] - CITY.roadHalf - 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cx > CITY.park.x0 - 4 && cx < CITY.park.x1 + 4 && cz > CITY.park.z0 - 4 && cz < CITY.park.z1 + 4) continue;
      const w = x1 - x0;
      const d = z1 - z0;
      const tall = Math.abs(cx) < 60 && Math.abs(cz) < 60;
      const h1 = rng.range(tall ? 18 : 8, tall ? 40 : 22);
      const b1 = makeBuilding(rng, winTex, cx - w * 0.18, cz, w * 0.55, d * 0.8, h1);
      group.add(b1);
      solids.push(b1.userData.solid);
      if (rng.chance(0.6)) {
        const h2 = rng.range(7, 16);
        const b2 = makeBuilding(rng, winTex, cx + w * 0.28, cz + d * 0.12, w * 0.34, d * 0.55, h2);
        group.add(b2);
        solids.push(b2.userData.solid);
      }
    }
  }

  // Park trees.
  for (let i = 0; i < 9; i++) {
    const palm = makePalm(rng);
    palm.position.set(rng.range(CITY.park.x0 + 3, CITY.park.x1 - 3), 0, rng.range(CITY.park.z0 + 3, CITY.park.z1 - 3));
    group.add(palm);
  }

  // Beach palms.
  for (let i = 0; i < 12; i++) {
    const palm = makePalm(rng);
    palm.position.set(-220 + i * 40 + rng.range(-8, 8), 0, CITY.beachZ + rng.range(2, 12));
    group.add(palm);
  }

  // Pier + lighthouse.
  const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.pierWood });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, CITY.pierZ1 - CITY.pierZ0), pierMat);
  deck.position.set(CITY.pierX, 1.2, (CITY.pierZ0 + CITY.pierZ1) / 2);
  group.add(deck);
  for (let z = CITY.pierZ0 + 6; z < CITY.pierZ1; z += 12) {
    for (const dx of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 6), pierMat);
      post.position.set(CITY.pierX + dx, 0.4, z);
      group.add(post);
    }
  }
  const lh = new THREE.Group();
  const lhBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 4.2, 16, 12),
    new THREE.MeshLambertMaterial({ color: PALETTE.lighthouse }),
  );
  lhBase.position.y = 8;
  lh.add(lhBase);
  const lhBand = new THREE.Mesh(
    new THREE.CylinderGeometry(3.55, 3.7, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0xc04030 }),
  );
  lhBand.position.y = 12;
  lh.add(lhBand);
  const lhLamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lhLamp.position.y = 17;
  lh.add(lhLamp);
  const lhCap = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 2.4, 12),
    new THREE.MeshLambertMaterial({ color: 0x303030 }),
  );
  lhCap.position.y = 19;
  lh.add(lhCap);
  lh.position.set(CITY.lighthouse.x, 0, CITY.lighthouse.z);
  group.add(lh);
  solids.push({ x0: CITY.lighthouse.x - 4, z0: CITY.lighthouse.z - 4, x1: CITY.lighthouse.x + 4, z1: CITY.lighthouse.z + 4 });

  // Docks: containers and crates.
  const contColors = [0xa04030, 0x306080, 0x608030, 0x806030];
  for (let i = 0; i < 10; i++) {
    const w = rng.range(8, 12);
    const h = rng.range(2.6, 5.2);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 2.6),
      new THREE.MeshLambertMaterial({ color: rng.pick(contColors) }),
    );
    const x = rng.range(CITY.docks.x0 + 6, CITY.docks.x1 - 6);
    const z = rng.range(CITY.docks.z0 + 4, CITY.docks.z1 - 4);
    box.position.set(x, h / 2, z);
    box.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    group.add(box);
    solids.push({ x0: x - w / 2, z0: z - 2, x1: x + w / 2, z1: z + 2 });
  }

  // Streetlights along the main roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
  for (const c of [-100, 0, 100]) {
    for (let d = -140; d <= 140; d += 70) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(c + 6.5, 3.5, d);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(c + 6.5, 7.1, d);
      group.add(lamp);
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole2.position.set(d, 3.5, c + 6.5);
      group.add(pole2);
      const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp2.position.set(d, 7.1, c + 6.5);
      group.add(lamp2);
    }
  }

  scene.add(group);

  // 13 parked cars, parallel along the roads by the spawn point. The first
  // one sits at the curb (x 7) so it reads at the edge of the opening view
  // instead of blocking the camera; the rest sit on the road.
  const parkedSpots = [{ x: 7, z: 20, yaw: 0 }];
  for (const z of [-60, -40, -20, 0, 40, 60]) {
    parkedSpots.push({ x: 3.5, z, yaw: 0 });
  }
  for (const x of [-60, -40, -20, 20, 40, 60]) {
    parkedSpots.push({ x, z: 3.5, yaw: Math.PI / 2 });
  }

  return { group, solids, parkedSpots };
}
