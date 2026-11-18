// Solmar Bay — staged screenshots: four deterministic scenes the dossier
// carries. Each one sets up the world from the seed, steps the simulation a
// fixed number of fixed steps, places the camera, renders once, and raises
// window.__shotReady. Nothing here reads wall time or Math.random.

import * as THREE from 'three';
import { TUNING } from './config.js';

const STEP = 1 / 60;

function holdKey(input, code) {
  input.keys.add(code);
}

function releaseKey(input, code) {
  input.keys.delete(code);
}

function stepN(world, n) {
  for (let i = 0; i < n; i++) world.step(STEP);
}

export function runShot(name, seed, game) {
  const { world, input, snapCamera, renderOnce, showHud, hideHud, showTitle, hideTitle, setCinematic } = game;
  const player = world.player;

  if (name === 'start') {
    // Title over the living sunset city: from the east, looking west into
    // the sun so the skyline reads against the orange horizon.
    showTitle();
    hideHud();
    world.running = true;
    world.missions.start(0);
    setCinematic(new THREE.Vector3(150, 42, 70), new THREE.Vector3(-90, 16, -30));
    stepN(world, 90);
    renderOnce();
    window.__shotReady = true;
    return;
  }

  hideTitle();
  showHud();
  world.running = true;

  if (name === 'drive') {
    // Mission 1, driving the stolen car: 2 stars, traffic, park, minimap.
    world.missions.start(0);
    world.pressE();
    player.carYaw = Math.PI;
    // Pull the stolen curb car onto the road centre so the drive reads as
    // driving, not parked on the park lawn.
    player.x = 0;
    holdKey(input, 'KeyW');
    stepN(world, 150);
    releaseKey(input, 'KeyW');
    snapCamera();
    renderOnce();
    window.__shotReady = true;
    return;
  }

  if (name === 'chase') {
    // Wanted 3: a cop right behind the player and the helicopter airframe
    // in view, camera lifted.
    world.missions.start(0);
    world.pressE();
    player.carYaw = Math.PI;
    player.x = 0;
    world.police.setWanted(3);
    holdKey(input, 'KeyW');
    stepN(world, 120);
    releaseKey(input, 'KeyW');
    // Put the nearest cop right behind the player's car.
    const cop = world.police.cops[0];
    if (cop) {
      const fx = Math.sin(player.carYaw);
      const fz = Math.cos(player.carYaw);
      cop.x = player.x - fx * 9;
      cop.z = player.z - fz * 9;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = player.carYaw;
    }
    // Park the helicopter ahead of the player, airframe in frame.
    const heli = world.police.heli;
    heli.visible = true;
    const fx = Math.sin(player.carYaw);
    const fz = Math.cos(player.carYaw);
    heli.position.set(player.x + fx * 26 + 12, TUNING.heliHeight, player.z + fz * 26 - 6);
    heli.rotation.y = Math.atan2(player.x - heli.position.x, player.z - heli.position.z);
    // A longer camera distance flattens the lifted chase view so the cop
    // behind, the player car and the heli airframe all fit in frame; a
    // 4 m sideways slide keeps the streetlight off the centre line.
    snapCamera(22, 4);
    renderOnce();
    window.__shotReady = true;
    return;
  }

  if (name === 'mission') {
    // Mission 4 on foot: the golden crate and its beacon by the lighthouse,
    // the pier and the ocean behind it.
    world.missions.start(3);
    // Stand 10 m short of the crate so it reads clearly, with the beacon,
    // lighthouse and ocean behind it. Offset 3 m west of the pier centre
    // so the crate and beacon show beside the player instead of behind them.
    player.x = 57;
    player.z = 272;
    player.yaw = 0;
    player.mesh.position.set(57, 0, 272);
    player.mesh.rotation.y = 0;
    stepN(world, 30);
    // The pier deck tops out at y 1.5, and the walk step resets the mesh
    // to y 0, so lift the player onto the deck for the render.
    player.mesh.position.y = 1.5;
    snapCamera();
    renderOnce();
    window.__shotReady = true;
    return;
  }

  // Unknown shot name: render whatever the world holds.
  renderOnce();
  window.__shotReady = true;
}
