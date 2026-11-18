// Solmar Bay — tuning, palette and story data for "Sunset Heat: Solmar Bay".
// One place for every number a designer would tweak: city size, speeds,
// wanted rules, mission list and the colours of the sunset city.
export const CITY = {
  half: 128,          // playable half-extent in metres (city + beach)
  roadSpacing: 32,    // grid pitch; roads run at multiples of this
  roadHalf: 6,        // half width of a road
  blockHalf: 9,       // half size of a buildable block
  oceanX: -112,       // west of this is beach, then water
  beachX: -128,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  health: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  maxSpeed: 42,
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  radius: 1.6,
  health: 100,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14,   // seconds unseen before a star drops
  bustSeconds: 2.0,   // seconds a cop must hold the player to bust them (was 2.5)
};

export const SAVE_KEY = 'solmar-bay.save.v1';

export const PALETTE = {
  skyTop: '#2e4a7a',
  skyMid: '#e8825a',
  skyLow: '#ffc27a',
  sun: '#ffd9a0',
  ocean: '#1e6f8e',
  sand: '#e8c98f',
  asphalt: '#33363d',
  sidewalk: '#8f8578',
  building: ['#e8a37c', '#d98a7a', '#c97e6d', '#e0b184', '#b98a9e', '#7fa3b8', '#a8b6a0', '#d9c08a'],
  glass: '#ffd27a',
  grass: '#7da05c',
  palm: '#3f7a4a',
};

// The story: Rae Calloway, a getaway driver trying to go straight in Solmar Bay,
// gets pulled back in by fixer Dario Venn. Six missions, each one job.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Fare', giver: 'Dario Venn',
    brief: 'Dario needs a driver. Steal any car on the street and bring it to his garage.',
    objectives: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 48, z: 48, radius: 6, text: 'Drive to Dario\u2019s garage' },
    ],
    reward: 500,
  },
  {
    id: 'm2', title: 'Sunset Run', giver: 'Dario Venn',
    brief: 'A package for the pier, and the buyer will not wait. Get it there before the clock runs out.',
    objectives: [
      { type: 'goto', x: -96, z: -96, radius: 7, text: 'Reach the pier drop-off', timer: 75 },
    ],
    reward: 900,
  },
  {
    id: 'm3', title: 'Heat Wave', giver: 'Lena Cross',
    brief: 'Lena says the harbour cops are jumpy tonight. Get the heat off you — stay out of sight until it cools.',
    objectives: [
      { type: 'evade', text: 'Lose your wanted level (stay out of police sight)' },
    ],
    reward: 800,
  },
  {
    id: 'm4', title: 'Harbour Lights', giver: 'Dario Venn',
    brief: 'Three crates on the docks, each one worth a fortune. Grab them all — on foot if you have to.',
    objectives: [
      { type: 'collect', x: -96, z: -64, radius: 4, text: 'Collect crate 1 of 3 at the docks' },
      { type: 'collect', x: -64, z: -96, radius: 4, text: 'Collect crate 2 of 3 at the docks' },
      { type: 'collect', x: -96, z: -32, radius: 4, text: 'Collect crate 3 of 3 at the docks' },
    ],
    reward: 1500,
  },
  {
    id: 'm5', title: 'The Getaway', giver: 'Lena Cross',
    brief: 'Lena is in the passenger seat and the whole city is after you. Hit both checkpoints, then lose them.',
    objectives: [
      { type: 'goto', x: 64, z: -64, radius: 7, text: 'Checkpoint 1: the marina gate' },
      { type: 'goto', x: -32, z: 96, radius: 7, text: 'Checkpoint 2: the south bridge' },
      { type: 'evade', text: 'Lose the cops' },
    ],
    reward: 2200,
  },
  {
    id: 'm6', title: 'King of Solmar', giver: 'Dario Venn',
    brief: 'One last run: the lighthouse at the end of the pier, with every cop in Solmar Bay on your tail. Make it.',
    objectives: [
      { type: 'goto', x: -118, z: -118, radius: 8, text: 'Reach the lighthouse with the cops behind you' },
    ],
    reward: 5000,
  },
];

export const RADIO_STATIONS = [
  { name: 'SOLMAR FM 88.1 — Sunset Drive', hue: 'synthwave' },
  { name: 'BAHIA 94.6 — Latin Nights', hue: 'latin' },
  { name: 'PALM 101.3 — Lo-Fi Coast', hue: 'lofi' },
];

export const SHOPS = [
  { name: 'Burger Barn', x: 16, z: -16, kind: 'food', heal: 40, price: 25 },
  { name: 'Harbor Arms', x: -16, z: 64, kind: 'ammo', ammo: 24, price: 150 },
  { name: 'Sunset Spray Shop', x: 80, z: 16, kind: 'spray', price: 100 },
];
