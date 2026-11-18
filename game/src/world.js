// The world: everything that simulates, wired together. The city, traffic,
// pedestrians, police, missions and the player live here; step() advances one
// fixed 1/60 s step and returns the events that happened, so the main loop
// can react (toasts, sounds, screens) without the rules knowing about them.
// Nothing here reads the wall clock or Math.random — only the seeded RNG.
import { CITY, SHOPS, WANTED } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createTraffic, createParkedCars, updateTraffic } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './people.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createPlayer, stepOnFoot, stepDriving, nearestCar, enterCar, exitCar } from './player.js';

export const STEP = 1 / 60;

export function createWorld(scene, seed, audio) {
  const random = createRandom(seed);
  const city = buildCity(scene, random);
  const traffic = createTraffic(scene, random, 14);
  const parked = createParkedCars(scene, random, 13);
  const peds = createPedestrians(scene, random, 26);
  const police = createPolice(scene);
  const missions = createMissions(scene);
  const player = createPlayer(scene);
  const allCars = () => traffic.concat(parked);

  const state = {
    time: 0,
    cash: 250,
    missionIndex: 0,
    missionStarted: false,
    stoleCarFlag: false,
    heatCooldown: 0,
    hurtCooldown: 0,
    respawned: false,
  };

  function clockString() {
    const minutes = 18 * 60 + 42 + Math.floor(state.time / 8);
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function nearestShop() {
    for (const shop of SHOPS) {
      if (Math.hypot(shop.x - player.x, shop.z - player.z) < 6) return shop;
    }
    return null;
  }

  function buyAt(shop) {
    if (state.cash < shop.price) return 'Not enough cash for ' + shop.name + '.';
    state.cash -= shop.price;
    if (shop.kind === 'food') {
      player.health = Math.min(100, player.health + shop.heal);
      return `${shop.name}: ate well. Health ${Math.round(player.health)}.`;
    }
    if (shop.kind === 'ammo') {
      player.ammo += shop.ammo;
      return `${shop.name}: bought ${shop.ammo} rounds. Ammo ${player.ammo}.`;
    }
    police.clearHeat();
    return `${shop.name}: fresh paint. The heat is off you.`;
  }

  function addHeat(stars) {
    if (state.heatCooldown > 0) return;
    state.heatCooldown = 1.5;
    police.addHeat(stars, player.x, player.z, random);
    if (audio) audio.siren(true);
  }

  // One fixed step. `input` is {forward, strafe, run} plus edge flags the
  // caller passes through `edges`. `cameraYaw` orients on-foot movement.
  // Returns an array of event names for the main loop.
  function step(dt, input, edges, cameraYaw) {
    const events = [];
    state.time += dt;
    player.time = state.time;
    if (state.heatCooldown > 0) state.heatCooldown -= dt;
    if (state.hurtCooldown > 0) state.hurtCooldown -= dt;
    else if (player.health < 100) player.health = Math.min(100, player.health + dt * 1.5);

    const move = {
      forward: Math.max(-1, Math.min(1, input.forward)),
      strafe: Math.max(-1, Math.min(1, input.strafe)),
      run: input.run,
    };

    // --- Enter / exit car, or buy at a shop --------------------------------
    if (edges.enter) {
      if (player.inCar) {
        exitCar(player);
      } else {
        // Reach 6 m, not 4.2: traffic rolls at 7–11 m/s, so a car in range
        // on the keypress was often out of range by the time the step ran,
        // and E felt dead. Wrecked cars are skipped by nearestCar.
        const car = nearestCar(player, allCars(), 6.0);
        const shop = nearestShop();
        if (car) {
          // Capture "was it stealable" BEFORE enterCar: enterCar clears
          // car.parked, so reading car.parked after it is always false
          // and a parked-car steal never registered — no heat, no
          // stoleCarFlag, and mission 1 never advanced even though Rae
          // was driving the stolen car. That is the mission-1 stall.
          const wasStealable = car.parked || traffic.includes(car);
          enterCar(player, car);
          if (wasStealable) {
            state.stoleCarFlag = true;
            addHeat(1);
            events.push('stole-car');
          }
        } else if (shop) {
          events.push('shop:' + buyAt(shop));
        }
      }
    }

    // --- Movement ------------------------------------------------------------
    if (player.inCar) stepDriving(player, dt, move, city.colliders);
    else stepOnFoot(player, dt, move, cameraYaw, city.colliders);

    // --- Punch ---------------------------------------------------------------
    if (edges.punch && !player.inCar && player.punchTimer <= 0) {
      player.punchTimer = 0.45;
      if (audio) audio.punch();
      for (const ped of peds) {
        if (ped.health > 0 && Math.hypot(ped.x - player.x, ped.z - player.z) < 2.2) {
          ped.health = 0;
          addHeat(1);
          events.push('punched-ped');
          break;
        }
      }
    }

    // --- Shoot ---------------------------------------------------------------
    if (edges.shoot && player.shootTimer <= 0 && player.ammo > 0) {
      player.shootTimer = 0.35;
      player.ammo -= 1;
      if (audio) audio.shot();
      let best = null;
      let bestD = 32;
      const targets = peds.filter((p) => p.health > 0).concat(police.cops);
      for (const t of targets) {
        const dx = t.x - player.x;
        const dz = t.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d >= bestD) continue;
        const ang = Math.atan2(dx, dz);
        let diff = ang - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 0.5) { best = t; bestD = d; }
      }
      if (best) {
        if (best.health !== undefined) best.health -= 34;
        else best.health = 66;
        if (police.cops.includes(best)) addHeat(1);
        else addHeat(1);
        events.push('shot-hit');
      }
    }

    // --- Car collisions: traffic and pedestrians ------------------------------
    if (player.inCar) {
      for (const car of traffic) {
        if (car === player.inCar) continue;
        if (car.hitCooldown > 0) car.hitCooldown -= dt;
        const d = Math.hypot(car.x - player.x, car.z - player.z);
        if (d < 3.4) {
          const push = (3.4 - d) / 2;
          const nx = (player.x - car.x) / (d || 1);
          const nz = (player.z - car.z) / (d || 1);
          player.inCar.x += nx * push;
          player.inCar.z += nz * push;
          car.x -= nx * push;
          car.z -= nz * push;
          // A hard hit costs speed and health once per impact, not every
          // step the two cars stay touching — otherwise a nudge grinds the
          // player to a halt while the cars slide apart.
          if (Math.abs(player.speed) > 8 && car.hitCooldown <= 0) {
            car.hitCooldown = 0.8;
            player.inCar.health -= 6;
            if (audio) audio.crash();
            addHeat(1);
            events.push('crash');
            player.speed *= 0.7;
          }
        }
      }
      for (const ped of peds) {
        if (ped.health <= 0) continue;
        const d = Math.hypot(ped.x - player.x, ped.z - player.z);
        if (d < 2.4 && Math.abs(player.speed) > 3) {
          ped.health = 0;
          addHeat(1);
          events.push('hit-ped');
        }
      }
      if (player.inCar.health <= 0) {
        player.inCar.health = 0;
        player.inCar.parked = true;
        exitCar(player);
        events.push('car-wrecked');
      }
    }

    // --- Traffic, pedestrians, city ------------------------------------------
    updateTraffic(traffic, dt);
    updatePedestrians(peds, dt, {
      x: player.x, z: player.z,
      active: (player.inCar && Math.abs(player.speed) > 8) || player.punchTimer > 0.2,
    });
    city.update(dt);

    // --- Police ---------------------------------------------------------------
    const policeEvent = police.update(dt, player, random);
    if (policeEvent === 'busted') events.push('busted');
    if (audio) audio.siren(police.wanted > 0);

    // --- Missions ---------------------------------------------------------------
    if (state.missionStarted && !missions.done) {
      const result = missions.update(dt, {
        stoleCar: state.stoleCarFlag,
        playerX: player.x,
        playerZ: player.z,
        wanted: police.wanted,
      });
      if (result === 'objective') {
        events.push('objective');
        if (audio) audio.pickup();
      } else if (result === 'complete') {
        const mission = missions.current();
        state.cash += mission.reward;
        events.push('mission-complete');
        if (audio) audio.mission();
        state.stoleCarFlag = false;
        const next = missions.startNext();
        if (next) {
          state.missionIndex = missions.index;
          events.push('mission-start');
        } else {
          events.push('all-done');
        }
      } else if (result === 'failed') {
        events.push('mission-failed');
        missions.start(missions.index);
      }
    }
    missions.updateVisual(dt, state.time);

    // --- Player health ----------------------------------------------------------
    if (player.health <= 0) events.push('wasted');

    if (audio) audio.engine(player.inCar ? player.speed : 0, !!player.inCar);
    return events;
  }

  function startMission() {
    if (state.missionStarted) return missions.current();
    state.missionStarted = true;
    missions.start(state.missionIndex);
    return missions.current();
  }

  function respawn() {
    // Busted: a night in the cells, a fine, and back on the street.
    state.cash = Math.max(0, state.cash - 200);
    player.health = 100;
    if (player.inCar) exitCar(player);
    player.x = 16;
    player.z = 64;
    player.heading = Math.PI;
    player.mesh.position.set(player.x, 0, player.z);
    police.clearHeat();
    if (audio) audio.siren(false);
  }

  function reset() {
    state.time = 0;
    state.cash = 250;
    state.missionIndex = 0;
    state.missionStarted = false;
    state.stoleCarFlag = false;
    player.health = 100;
    player.ammo = 12;
    if (player.inCar) exitCar(player);
    player.x = 0;
    player.z = 8;
    player.heading = 0;
    player.mesh.visible = true;
    player.mesh.position.set(0, 0, 8);
    police.clearHeat();
    for (const car of parked) {
      car.health = 100;
      car.parked = true;
      car.speed = 0;
      // Back to its home spot: without this, a car stolen and abandoned
      // in the last run stayed wherever it was left, so a fresh game could
      // start with no car anywhere near the spawn.
      car.x = car.homeX;
      car.z = car.homeZ;
      car.heading = car.homeHeading;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    for (const ped of peds) ped.health = 30;
  }

  // What the HUD reads each frame.
  function hudState(station) {
    const mission = state.missionStarted ? missions.current() : null;
    const obj = mission ? missions.currentObjective() : null;
    let missionTarget = missions.objectiveTarget();
    // During a steal objective the beacon is off and there is no marker
    // at all, so point the minimap diamond at the nearest stealable car.
    if (obj && obj.type === 'steal') {
      const car = nearestCar(player, allCars(), 200);
      if (car) missionTarget = { x: car.x, z: car.z };
    }
    return {
      player,
      cash: state.cash,
      wanted: police.wanted,
      cops: police.cops,
      traffic,
      parked,
      mission,
      objectiveText: obj ? obj.text : '',
      timer: missions.timer,
      missionTarget,
      station,
      clock: clockString(),
      onFootRun: false,
    };
  }

  return {
    state, player, police, missions, traffic, parked, peds, city,
    step, startMission, respawn, reset, hudState,
    get cash() { return state.cash; },
    get missionIndex() { return state.missionIndex; },
  };
}
