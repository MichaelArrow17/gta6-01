// Solmar Bay — the world: builds the city, traffic, crowd, police and missions,
// steps the simulation, runs the shops, and saves the player's progress.

import * as THREE from 'three';
import { CITY, MISSIONS, SAVE_KEY, SHOPS, TUNING } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createTraffic, createParkedCars } from './vehicles.js';
import { createCrowd } from './people.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createPlayer } from './player.js';

export function createWorld(scene, seed) {
  const rng = makeRng(seed);
  const city = buildCity(scene, rng);
  const traffic = createTraffic(scene, rng);
  const parked = createParkedCars(scene, rng, city.parkedSpots);
  const crowd = createCrowd(scene, rng);
  const police = createPolice(scene, rng);
  const missions = createMissions(scene);
  const player = createPlayer(scene, rng, city.solids);

  const world = {
    scene,
    rng,
    city,
    traffic,
    parked,
    crowd,
    police,
    missions,
    player,
    cameraYaw: CITY.spawn.yaw,
    time: 0,
    clockMinutes: 18 * 60 + 30,
    running: false,
    paused: false,
    events: [],
    toast: '',
    toastTimer: 0,
    nearShop: null,

    say(text) {
      this.toast = text;
      this.toastTimer = 4;
    },

    loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const save = JSON.parse(raw);
        if (typeof save.cash === 'number') player.cash = save.cash;
        if (typeof save.mission === 'number') missions.start(Math.min(save.mission, 5));
        return true;
      } catch {
        return false;
      }
    },

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: player.cash,
          mission: missions.index,
        }));
      } catch {
        // Storage unavailable (private mode, sandboxed iframe) — play on.
      }
    },

    nearestParked() {
      let best = null;
      let bestD = Infinity;
      for (const car of parked) {
        if (car.taken) continue;
        const d = Math.hypot(car.x - player.x, car.z - player.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return bestD < TUNING.interactRange ? best : null;
    },

    nearestTrafficCar() {
      let best = null;
      let bestD = Infinity;
      for (const car of traffic.cars) {
        const p = car.mesh.position;
        const d = Math.hypot(p.x - player.x, p.z - player.z);
        if (d < bestD) {
          bestD = d;
          best = { mesh: car.mesh, x: p.x, z: p.z, yaw: car.mesh.rotation.y, taken: true, owned: false, traffic: car };
        }
      }
      return bestD < TUNING.interactRange ? best : null;
    },

    nearestShop() {
      for (const shop of SHOPS) {
        if (Math.hypot(shop.x - player.x, shop.z - player.z) < TUNING.interactRange) return shop;
      }
      return null;
    },

    useShop(shop) {
      if (shop.kind === 'food') {
        if (player.cash < shop.price) return 'Not enough cash for a meal.';
        player.cash -= shop.price;
        player.health = TUNING.startHealth;
        return 'Ate at Sunset Diner — health restored.';
      }
      if (shop.kind === 'ammo') {
        if (player.cash < shop.price) return 'Not enough cash for bullets.';
        player.cash -= shop.price;
        player.ammo += 12;
        return 'Bought 12 bullets at Ammo Corner.';
      }
      if (player.cash < shop.price) return 'Not enough cash for a respray.';
      player.cash -= shop.price;
      police.setWanted(0);
      return 'Fresh paint at Spray Works — the heat is off.';
    },

    pressE() {
      if (player.inCar) {
        player.exitCar();
        this.events.push('exited-car');
        return;
      }
      const shop = this.nearestShop();
      if (shop) {
        this.say(this.useShop(shop));
        return;
      }
      const parkedCar = this.nearestParked();
      const target = parkedCar || this.nearestTrafficCar();
      if (target) {
        const result = player.tryEnterCar(target);
        if (result === 'stolen') {
          // Stealing a car is a crime: 2 wanted stars, set before the job
          // advances so the drive screenshot shows them.
          police.setWanted(2);
          this.say('You stole a car — the cops are coming.');
        }
        this.events.push(result === 'stolen' ? 'stole-car' : 'entered-car');
        return;
      }
      const crate = missions.crate;
      if (crate.visible) {
        const d = Math.hypot(crate.position.x - player.x, crate.position.z - player.z);
        if (d < TUNING.interactRange) {
          player.nearCrate = true;
          this.events.push('collect-crate');
          player.nearCrate = false;
          return;
        }
      }
      this.say('Nothing to use here.');
    },

    pressF() {
      const result = player.punch(crowd.peds, police);
      if (result === 'hit-ped') {
        police.addWanted(1);
        this.say('You hit a pedestrian — someone called the cops.');
      }
    },

    pressG() {
      const result = player.shoot(crowd.peds, police);
      if (result === 'no-ammo') {
        this.say('Out of bullets — visit Ammo Corner.');
      } else if (result === 'hit-ped' || result === 'hit-cop') {
        police.addWanted(2);
      }
    },

    step(dt) {
      if (!this.running || this.paused) return;
      this.time += dt;
      this.clockMinutes += dt / 10;
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) this.toast = '';
      }
      player.update(dt, this.input, this);
      traffic.update(dt);
      crowd.update(dt, {
        x: player.x,
        z: player.z,
        active: player.inCar ? Math.abs(player.carSpeed) > 12 : false,
      });
      const bust = police.update(dt, player, city.solids);
      if (bust === 'busted') {
        player.cash = Math.max(0, player.cash - TUNING.bustFine);
        player.respawn();
        police.setWanted(0);
        this.events.push('busted');
      }
      if (player.health <= 0) {
        player.respawn();
        police.setWanted(0);
        this.events.push('wasted');
      }
      const missionEvent = missions.update(dt, player);
      if (missionEvent === 'job-done') {
        const finished = MISSIONS[missions.index];
        const reward = finished.reward;
        const giver = finished.giver;
        player.cash = missions.completeJob(player.cash);
        this.save();
        this.events.push('job-done');
        this.say(`Job complete — $${reward} from ${giver}.`);
      } else if (missionEvent === 'failed') {
        this.say('Too slow — the job restarts.');
      }
      this.nearShop = this.nearestShop();
    },
  };
  return world;
}
