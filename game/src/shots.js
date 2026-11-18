// The screenshot scenes behind ?shot=<name>&seed=<n>. Each one sets the real
// world up and plays its real rules forward for a fixed number of steps with
// scripted inputs — no faked props — so the frame is what the game really
// looks like, and the same seed always gives the same frame.
//   start  — title screen over the sunset city, Rae by her car on the beach road
//   drive  — mission 1: driving through downtown toward Dario's garage
//   chase  — wanted level 3: police cars and the helicopter on Rae's tail
//   mission— mission 4: on foot at the docks, grabbing a crate, cops closing in
import { STEP } from './world.js';
import { createRandom } from './random.js';
import { enterCar } from './player.js';

const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';

function driveForward(world, seconds, strafe) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { forward: 1, strafe: strafe || 0, run: false }, {}, 0);
  }
}

function idle(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { forward: 0, strafe: 0, run: false }, {}, 0);
  }
}

function stageStart(world) {
  // Rae on foot by a parked car on the beach road, city glowing behind her.
  const p = world.player;
  p.x = -100;
  p.z = 24;
  p.heading = Math.PI / 2;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  idle(world, 6);
  return {
    screen: SCREEN_TITLE,
    camPos: [-118, 9, 44],
    camLook: [-60, 6, 0],
  };
}

function stageDrive(world, seed) {
  world.startMission();
  const p = world.player;
  const car = world.parked[0];
  p.x = car.x;
  p.z = car.z;
  enterCar(p, car);
  world.state.stoleCarFlag = true; // the steal already happened in this scene
  world.police.addHeat(1, p.x, p.z, createRandom(seed + 5)); // stealing is a crime
  car.heading = Math.PI / 2; // east, down the main avenue
  car.x = -64;
  car.z = 0;
  driveForward(world, 2.4, 0);
  return {
    screen: SCREEN_PLAY,
    camPos: [p.x - 14, 7, p.z - 3],
    camLook: [p.x + 16, 2, p.z],
  };
}

function stageChase(world, seed) {
  world.startMission();
  const p = world.player;
  const car = world.parked[1];
  p.x = car.x;
  p.z = car.z;
  enterCar(p, car);
  world.state.stoleCarFlag = true;
  car.heading = Math.PI / 2;
  car.x = -48;
  car.z = 32;
  world.police.addHeat(3, p.x, p.z, createRandom(seed + 7));
  driveForward(world, 3.0, 0);
  return {
    screen: SCREEN_PLAY,
    camPos: [p.x - 16, 9.5, p.z + 2],
    camLook: [p.x + 14, 2, p.z],
  };
}

function stageMission(world, seed) {
  // Jump to mission 4: the docks job, on foot, one star of heat.
  world.state.missionIndex = 3;
  world.startMission();
  const p = world.player;
  // On the z=-64 road, walking west toward the first crate at (-96,-64),
  // the beach and ocean at the end of the road.
  p.x = -86;
  p.z = -64;
  p.heading = -Math.PI / 2;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  world.police.addHeat(1, p.x, p.z, createRandom(seed + 11));
  idle(world, 2.5);
  return {
    screen: SCREEN_PLAY,
    // Right behind Rae on the same road: her, the glowing crate ahead,
    // the beacon, and the ocean at the end of the street.
    camPos: [p.x + 12, 5.5, p.z],
    camLook: [-100, 2, -64],
  };
}

export function stageShot(name, world, seed) {
  if (name === 'drive') return stageDrive(world, seed);
  if (name === 'chase') return stageChase(world, seed);
  if (name === 'mission') return stageMission(world, seed);
  return stageStart(world);
}

export { SCREEN_TITLE, SCREEN_PLAY };
