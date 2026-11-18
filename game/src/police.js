// The wanted system: stars, the Solmar Bay police who chase them, and the
// helicopter that joins at three stars. Cops spawn on the roads ahead of the
// player, steer toward them, and ram; staying out of their sight cools the
// heat down, one star at a time. Getting caught on foot means busted.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';
import { WANTED } from './config.js';

export function createPolice(scene) {
  const cops = [];
  // The helicopter: it used to be a small dark box (0x1c2733) at 26 m, so
  // against the sunset sky only its searchlight beam ever read — the
  // airframe itself was invisible in the chase shot and in live play.
  // Now it is light-bodied with an emissive lift, a red stripe, a blinking
  // strobe, a nose light and a translucent rotor disc, it flies lower and
  // closer, and its beam reaches the ground.
  const heliGroup = new THREE.Group();
  const heliBodyMat = new THREE.MeshLambertMaterial({ color: 0xdfe8f0, emissive: 0x445566, emissiveIntensity: 0.5 });
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5.6), heliBodyMat);
  heliGroup.add(heliBody);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.4, 4.4), new THREE.MeshBasicMaterial({ color: 0xd92626 }));
  stripe.position.y = 0.15;
  heliGroup.add(stripe);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  heliGroup.add(rotor);
  const rotorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  );
  rotorDisc.rotation.x = -Math.PI / 2;
  rotorDisc.position.y = 1.08;
  heliGroup.add(rotorDisc);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.4), heliBodyMat);
  tail.position.set(0, 0.3, -4.4);
  heliGroup.add(tail);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  strobe.position.set(0, 1.25, 0);
  heliGroup.add(strobe);
  const noseLight = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  noseLight.position.set(0, -0.3, 2.9);
  heliGroup.add(noseLight);
  const search = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 12, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  // The cone is 12 long and hangs 6 below the group, so from a 12 m
  // cruise it just touches the ground (the old 20 m cone from a 20 m
  // cruise hung in the air and never reached the street).
  search.position.y = -6;
  // Tilt the beam toward the player (the group faces them, so local +Z is
  // their direction): the old vertical cone hung in the air and never
  // touched the ground.
  search.rotation.x = -0.35;
  heliGroup.add(search);
  heliGroup.visible = false;
  scene.add(heliGroup);

  let wanted = 0;
  let unseenTimer = 0;
  let bustTimer = 0;
  let heliAngle = 0;

  function wantedCount() {
    return Math.min(WANTED.maxStars, 1 + Math.floor(cops.length / 2));
  }

  function spawnCop(playerX, playerZ, random) {
    if (cops.length >= 8) return;
    const angle = random() * Math.PI * 2;
    const x = playerX + Math.sin(angle) * 55;
    const z = playerZ + Math.cos(angle) * 55;
    const mesh = createCarMesh(0x11151c, 'police');
    // White doors read as a police car at a glance.
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    door.position.set(0, 0.66, 0);
    mesh.add(door);
    scene.add(mesh);
    cops.push({ mesh, x, z, heading: 0, speed: 0, stuck: 0 });
  }

  function addHeat(stars, playerX, playerZ, random) {
    const before = wanted;
    wanted = Math.min(WANTED.maxStars, wanted + stars);
    unseenTimer = 0;
    if (wanted > before) {
      const need = wanted * 2 - cops.length;
      for (let i = 0; i < need; i += 1) spawnCop(playerX, playerZ, random);
    }
  }

  function clearHeat() {
    wanted = 0;
    unseenTimer = 0;
    bustTimer = 0;
    for (const cop of cops) scene.remove(cop.mesh);
    cops.length = 0;
    heliGroup.visible = false;
  }

  // Returns 'busted' when a cop holds the player on foot, else null.
  function update(dt, player, random) {
    let event = null;
    const px = player.x;
    const pz = player.z;
    // Cops see the player when one is within 45 m (or the player is speeding).
    let seen = false;
    for (const cop of cops) {
      if (Math.hypot(cop.x - px, cop.z - pz) < 45) { seen = true; break; }
    }
    if (wanted > 0) {
      if (seen) unseenTimer = 0;
      else {
        unseenTimer += dt;
        if (unseenTimer >= WANTED.decaySeconds) {
          unseenTimer = 0;
          wanted -= 1;
          if (cops.length > 0) {
            const gone = cops.pop();
            scene.remove(gone.mesh);
          }
        }
      }
    }
    const maxSpeed = 16 + wanted * 3.2;
    for (const cop of cops) {
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      // Close in: the old close speed (6) was slower than Rae's run (11),
      // so a running player could never be caught on foot and busted never
      // fired. 9 still lets a sprint escape, but a walking Rae gets held.
      const targetSpeed = dist > 4 ? maxSpeed : 9;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.2);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      // Flashing light bar.
      if (cop.mesh.userData.lightBar) {
        cop.mesh.userData.lightBar.material.color.setHex(Math.floor(player.time * 6) % 2 === 0 ? 0x2244ff : 0xff2222);
      }
      if (dist < 3.0 && !player.inCar) {
        bustTimer += dt;
        if (bustTimer >= WANTED.bustSeconds) event = 'busted';
      }
    }
    if (cops.length > 0 && !player.inCar) {
      let touching = false;
      for (const cop of cops) if (Math.hypot(cop.x - px, cop.z - pz) < 3.0) touching = true;
      if (!touching) bustTimer = 0;
    }
    // Helicopter at 3+ stars: circles overhead, keeps the player lit.
    // It cruises at 12 m, not 20: the chase camera looks down steeply
    // (top of frame only a few degrees above level), so at 20 m the
    // airframe sat above the frame and only the searchlight beam ever
    // showed — the "helicopter appears half the time" complaint. At 12 m
    // the airframe is in frame (with the camera lift in main.js) while
    // still clearing the low rooftops over the road.
    if (wanted >= 3) {
      heliGroup.visible = true;
      heliAngle += dt * 0.35;
      heliGroup.position.set(px + Math.sin(heliAngle) * 12, 12, pz + Math.cos(heliAngle) * 12);
      heliGroup.rotation.y = Math.atan2(px - heliGroup.position.x, pz - heliGroup.position.z);
      rotor.rotation.y += dt * 22;
      strobe.visible = Math.floor(player.time * 2) % 2 === 0;
    } else {
      heliGroup.visible = false;
    }
    return event;
  }

  return {
    get wanted() { return wanted; },
    get cops() { return cops; },
    addHeat,
    clearHeat,
    update,
  };
}
