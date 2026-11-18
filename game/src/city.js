// Solmar Bay itself: the sunset city. A grid of roads, pastel towers with lit
// windows, a park, a beach and ocean to the west, a pier with a lighthouse, the
// docks, palms and streetlights. Everything is built from boxes and canvas
// textures — no model files, no network — and the layout is fixed by the seed.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function skyTexture() {
  return canvasTexture(64, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4a6a9a');
    grad.addColorStop(0.45, '#c96a72');
    grad.addColorStop(0.62, PALETTE.skyMid);
    grad.addColorStop(0.75, PALETTE.skyLow);
    grad.addColorStop(1, '#ffe3b0');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = PALETTE.asphalt;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c94c';
    g.fillRect(w / 2 - 2, 8, 4, 28);
    g.fillRect(w / 2 - 2, 72, 4, 28);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(4, 0, 2, h);
    g.fillRect(w - 6, 0, 2, h);
  });
}

function facadeTexture(base, litRatio, random) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = random() < litRatio;
        g.fillStyle = lit ? PALETTE.glass : 'rgba(30,32,48,0.85)';
        g.fillRect(8 + c * 20, 10 + r * 20, 12, 12);
      }
    }
  });
}

function makePalm(random) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(PALM_TRUNK_GEO, PALM_TRUNK_MAT);
  trunk.position.y = 2.75;
  trunk.rotation.z = range(random, -0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(PALM_LEAF_GEO, PALM_LEAF_MAT);
    const angle = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.1, 5.6, Math.sin(angle) * 1.1);
    leaf.rotation.z = Math.cos(angle) * 1.1;
    leaf.rotation.x = -Math.sin(angle) * 1.1;
    group.add(leaf);
  }
  return group;
}

// Palms used to build a fresh geometry and two fresh materials per palm
// (~26 palms → ~180 draw calls and ~50 materials). Share them: one trunk
// and one leaf geometry/material for the whole city.
const PALM_TRUNK_GEO = new THREE.CylinderGeometry(0.14, 0.22, 5.5, 6);
const PALM_LEAF_GEO = new THREE.ConeGeometry(0.5, 3.2, 4);
const PALM_TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
const PALM_LEAF_MAT = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
// One shared rooftop material (was a fresh material per rooftop box).
const ROOF_MAT = new THREE.MeshLambertMaterial({ color: 0x5a5148 });

export function buildCity(scene, random) {
  const colliders = [];
  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;

  // --- Sky dome, sun and lights -------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-330, 42, -60);
  sun.lookAt(0, 20, 0);
  scene.add(sun);
  // Hemisphere fill: warm sky bounce above, warm ground bounce below.
  // The old ground colour (dark slate blue) left roads and sidewalks
  // near-black next to the glowing facades, so the scene read as bright
  // buildings floating over a black ground — the contrast complaint.
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x8a7a68, 1.2);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.9);
  sunLight.position.set(-120, 60, -40);
  scene.add(sunLight);
  scene.fog = new THREE.Fog(0xe88a5e, 160, 380);

  // --- Ground, ocean, beach -----------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x6b6f66 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-20, -0.05, 0);
  scene.add(ground);

  const oceanMat = new THREE.MeshLambertMaterial({ color: PALETTE.ocean });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, CITY.half * 2 + 80), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CITY.beachX - 44, 0.02, 0);
  scene.add(ocean);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(18, CITY.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 8, 0.03, 0);
  scene.add(sand);

  // --- Roads ----------------------------------------------------------------
  const roadLines = [-96, -64, -32, 0, 32, 64, 96];
  for (const x of roadLines) {
    // North-south road: 12 wide in x, 210 long in z.
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 22);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, 210), new THREE.MeshLambertMaterial({ map: tex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.06, 0);
    scene.add(road);
  }
  for (const z of roadLines) {
    // East-west road: 210 long in x, 12 wide in z; the dash texture is
    // rotated so the centre line runs along the road.
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.repeat.set(1, 22);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(210, CITY.roadHalf * 2), new THREE.MeshLambertMaterial({ map: tex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.06, z);
    scene.add(road);
  }

  // --- Buildings ------------------------------------------------------------
  const blockCentres = [];
  for (let bx = -80; bx <= 80; bx += 32) {
    for (let bz = -80; bz <= 80; bz += 32) blockCentres.push([bx, bz]);
  }
  const facades = PALETTE.building.map((c) => facadeTexture(c, 0.55, random));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // One material per (map, emissiveMap) pair, cached: the old code built a
  // fresh material per building (~68 materials, one per draw call's state
  // change). There are only 8 facades, so the cache stays small and the
  // city looks identical — the same random draws pick the same textures.
  const buildingMats = new Map();
  function buildingMat() {
    const mi = Math.floor(random() * facades.length);
    const ei = Math.floor(random() * facades.length);
    const key = `${mi}:${ei}`;
    let mat = buildingMats.get(key);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({
        map: facades[mi],
        emissive: 0xff9a4d,
        emissiveMap: facades[ei],
        // 0.18, not 0.25: the facades must glow at sunset, not outshine
        // the street — the old value made bright buildings float over a
        // black ground.
        emissiveIntensity: 0.18,
      });
      buildingMats.set(key, mat);
    }
    return mat;
  }
  for (const [bx, bz] of blockCentres) {
    // One block is the park; one is the plaza by the marina.
    if ((bx === 16 && bz === 16) || (bx === -16 && bz === -16)) continue;
    const count = pick(random, [1, 1, 2, 2, 3]);
    for (let i = 0; i < count; i += 1) {
      const w = range(random, 10, 16);
      const d = range(random, 10, 16);
      const dist = Math.hypot(bx, bz);
      const h = range(random, 8, 14) + Math.max(0, 34 - dist * 0.35) * random();
      const ox = count === 1 ? 0 : range(random, -4, 4);
      const oz = count === 1 ? 0 : range(random, -4, 4);
      const building = new THREE.Mesh(boxGeo, buildingMat());
      building.scale.set(w, h, d);
      building.position.set(bx + ox, h / 2, bz + oz);
      scene.add(building);
      // Rooftop box (AC unit / penthouse) so silhouettes vary.
      if (random() < 0.6) {
        const roof = new THREE.Mesh(boxGeo, ROOF_MAT);
        roof.scale.set(w * 0.4, 1.6, d * 0.4);
        roof.position.set(bx + ox, h + 0.8, bz + oz);
        scene.add(roof);
      }
      colliders.push({ x: bx + ox, z: bz + oz, hx: w / 2, hz: d / 2 });
    }
  }

  // --- Park (grass, palms, fountain) ---------------------------------------
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(16, 0.07, 16);
  scene.add(park);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.6, 0.8, 20),
    new THREE.MeshLambertMaterial({ color: 0x9fc4d4 }),
  );
  fountain.position.set(16, 0.4, 16);
  scene.add(fountain);
  colliders.push({ x: 16, z: 16, hx: 4.4, hz: 4.4 });

  // --- Plaza ----------------------------------------------------------------
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshLambertMaterial({ color: 0xb8a88a }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(-16, 0.07, -16);
  scene.add(plaza);

  // --- Palms: beach row + park + plaza --------------------------------------
  for (let z = -110; z <= 110; z += 18) {
    const palm = makePalm(random);
    palm.position.set(-104 + range(random, -2, 2), 0, z + range(random, -3, 3));
    scene.add(palm);
  }
  for (let i = 0; i < 8; i += 1) {
    const palm = makePalm(random);
    palm.position.set(16 + range(random, -11, 11), 0, 16 + range(random, -11, 11));
    if (Math.hypot(palm.position.x - 16, palm.position.z - 16) > 5.5) scene.add(palm);
  }

  // --- Streetlights along the main roads ------------------------------------
  // Step 48 (was 32): 25 lamp posts instead of 49 — same look, ~48 fewer
  // draw calls. The pole and bulb materials are shared across all lamps.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let x = -96; x <= 96; x += 48) {
    for (let z = -96; z <= 96; z += 48) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampMat);
      pole.position.set(x + 7, 3, z + 7);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(x + 7, 6.1, z + 7);
      scene.add(bulb);
    }
  }

  // --- Pier + lighthouse (west end, the m6 destination) ----------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c40 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 6), pierMat);
  pier.position.set(-118, 0.5, -96);
  scene.add(pier);
  for (let i = 0; i < 6; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), pierMat);
    post.position.set(-104 - i * 6, 0, -96 + (i % 2 === 0 ? 2.6 : -2.6));
    scene.add(post);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 16, 12), lightMat);
  tower.position.set(-136, 8, -96);
  scene.add(tower);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampRoom.position.set(-136, 17, -96);
  scene.add(lampRoom);
  colliders.push({ x: -136, z: -96, hx: 3, hz: 3 });
  // Rotating beacon beam.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(-136, 17, -96);
  scene.add(beam);

  // --- Docks: crates near the pier (m4) --------------------------------------
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763e });
  const crateGeo = new THREE.BoxGeometry(2, 2, 2);
  // Decorative dock crates (the mission's glowing crates are added by missions.js).
  const crateSpots = [[-104, -80], [-56, -88], [-88, -72]];
  for (const [cx, cz] of crateSpots) {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(cx, 1, cz);
    crate.rotation.y = range(random, 0, 1);
    scene.add(crate);
    colliders.push({ x: cx, z: cz, hx: 1.1, hz: 1.1 });
  }

  // --- Shop awnings ----------------------------------------------------------
  const shopDefs = [
    { x: 16, z: -16, color: 0xe5534b },
    { x: -16, z: 64, color: 0x4fc3f7 },
    { x: 80, z: 16, color: 0xf2c94c },
  ];
  for (const shop of shopDefs) {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 3), new THREE.MeshLambertMaterial({ color: shop.color }));
    awning.position.set(shop.x, 3.4, shop.z - 8);
    scene.add(awning);
  }

  let t = 0;
  return {
    colliders,
    roadLines,
    update(dt) {
      t += dt;
      beam.rotation.y = t * 0.5;
      oceanMat.color.setHSL(0.54, 0.62, 0.32 + Math.sin(t * 0.4) * 0.02);
    },
  };
}
