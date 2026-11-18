// Solmar Bay — tuning, palette, missions, radio stations and shops.
// Every number the simulation reads lives here so a balance change is one edit.

export const TUNING = {
  walkSpeed: 6,
  runSpeed: 9.5,
  carAccel: 14,
  carBrake: 30,
  carReverse: 8,
  carMaxSpeed: 30,
  carTurn: 1.9,
  trafficCount: 14,
  trafficSpeed: 9,
  pedCount: 26,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.2,
  copSpeed: 13,
  copRamSpeed: 17,
  heliHeight: 12,
  heliOrbit: 26,
  cameraFollow: 3.0,
  cameraLiftWanted: 3.5,
  bustFine: 200,
  wantedDecaySeconds: 8,
  copSightRange: 55,
  shotRange: 34,
  punchRange: 2.2,
  interactRange: 4.5,
  startCash: 120,
  startHealth: 100,
  startAmmo: 12,
};

export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyHorizon: 0xff9a5c,
  sun: 0xffd27a,
  fog: 0xe08a5a,
  hemiSky: 0xffc98a,
  hemiGround: 0xb0703a,
  ground: 0x8a6b4a,
  road: 0x3a3a40,
  roadLine: 0xd8c86a,
  sidewalk: 0x9a8f80,
  grass: 0x5d8a4a,
  sand: 0xe0c088,
  ocean: 0x2a6a8a,
  pierWood: 0x7a5a3a,
  lighthouse: 0xf0e8d8,
  building: [0xd8a06a, 0xc08a5a, 0xb0785a, 0xd8b078, 0xa86850, 0xe0b088],
  windowLit: 0xffd27a,
  carColors: [0xc04030, 0x3060c0, 0xd8c040, 0x40a080, 0x8040a0, 0xd8d8d8, 0x303030, 0xe07830],
  copColor: 0x20242a,
  heliColor: 0x30343a,
  crateGold: 0xffc040,
  beacon: 0xff5040,
  marker: 0x40d080,
};

// The city grid. Roads run on these coordinates in both axes; blocks sit between.
export const CITY = {
  roadAt: [-150, -100, -50, 0, 50, 100, 150],
  roadHalf: 5,
  blockHalf: 20,
  groundSize: 560,
  beachZ: 172,
  oceanZ: 205,
  pierX: 60,
  pierZ0: 200,
  pierZ1: 278,
  lighthouse: { x: 60, z: 288 },
  docks: { x0: 182, x1: 238, z0: -44, z1: 64 },
  park: { x0: 6, x1: 44, z0: -44, z1: -6 },
  spawn: { x: 4, z: 18, yaw: Math.PI },
  garage: { x: 100, z: -100 },
};

export const MISSIONS = [
  {
    title: 'Job 1 — First Drive',
    giver: 'Dario Venn',
    brief: 'Rae, the crew needs wheels. Get in a car, any car, and bring it to my garage.',
    steps: [
      { text: 'Get in a car (press E near one)', kind: 'enter-car' },
      { text: 'Drive to Dario\u2019s garage', kind: 'drive-to', target: [100, -100], radius: 9 },
    ],
    reward: 150,
  },
  {
    title: 'Job 2 — Pickup',
    giver: 'Lena Cross',
    brief: 'Lena is waiting at the park. Pick her up and keep it quiet.',
    steps: [
      { text: 'Pick up Lena at the park', kind: 'pickup', target: [25, -25], radius: 8 },
    ],
    reward: 200,
  },
  {
    title: 'Job 3 — Hot Delivery',
    giver: 'Dario Venn',
    brief: 'A package for the docks. The clock is running — 90 seconds, no excuses.',
    steps: [
      { text: 'Deliver the package to the docks (90s)', kind: 'timed', target: [205, 10], radius: 10, seconds: 90 },
    ],
    reward: 350,
  },
  {
    title: 'Job 4 — The Golden Crate',
    giver: 'Lena Cross',
    brief: 'A crate washed up by the lighthouse, on foot. Follow the beacon and grab it.',
    steps: [
      { text: 'Collect the golden crate at the lighthouse', kind: 'collect', target: [60, 282], radius: 5 },
    ],
    reward: 400,
  },
  {
    title: 'Job 5 — Getaway',
    giver: 'Dario Venn',
    brief: 'The heat is on. Hit all three checkpoints and lose the tail.',
    steps: [
      { text: 'Checkpoint 1 — north avenue', kind: 'drive-to', target: [0, -150], radius: 9 },
      { text: 'Checkpoint 2 — west pier road', kind: 'drive-to', target: [-150, 50], radius: 9 },
      { text: 'Checkpoint 3 — safehouse', kind: 'drive-to', target: [-100, 100], radius: 9 },
    ],
    reward: 500,
  },
  {
    title: 'Job 6 — The Last Run',
    giver: 'Lena Cross',
    brief: 'One last run to the harbor with the whole city watching. Make it count.',
    steps: [
      { text: 'Drive Lena to the harbor', kind: 'drive-to', target: [205, 55], radius: 10 },
    ],
    reward: 800,
  },
];

export const RADIOS = [
  { name: 'Solmar FM', desc: 'sunset synth', base: 220, scale: [0, 3, 5, 7, 10], bpm: 96 },
  { name: 'Bay Rock', desc: 'guitar drive', base: 165, scale: [0, 2, 3, 7, 9], bpm: 128 },
  { name: 'Neon Nights', desc: 'night pulse', base: 196, scale: [0, 3, 5, 8, 10], bpm: 116 },
];

export const SHOPS = [
  { name: 'Sunset Diner', kind: 'food', x: 56, z: 6, price: 10, blurb: 'Eat — restores health' },
  { name: 'Ammo Corner', kind: 'ammo', x: 156, z: 56, price: 25, blurb: 'Buy 12 bullets' },
  { name: 'Spray Works', kind: 'spray', x: 94, z: -94, price: 50, blurb: 'Lose the heat — wanted to 0' },
];

export const SAVE_KEY = 'solmar-bay-save-v1';
