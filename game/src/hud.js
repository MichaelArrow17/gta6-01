// Solmar Bay — the HUD: cash, wanted stars, health, speed, radio, clock,
// mission banner, toasts, the circular minimap, and the game's screens.

import { CITY } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  function starsText(n) {
    let out = '';
    for (let i = 0; i < 5; i++) out += i < n ? '★' : '☆';
    return out;
  }

  function clockText(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function drawMinimap(world) {
    const size = minimap.width;
    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 560;
    mctx.clearRect(0, 0, size, size);
    mctx.save();
    mctx.beginPath();
    mctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#20242e';
    mctx.fillRect(0, 0, size, size);
    // Ocean strip at the bottom (south).
    mctx.fillStyle = '#2a6a8a';
    mctx.fillRect(0, (CITY.oceanZ + 280) * scale, size, size);
    // Roads.
    mctx.strokeStyle = '#5a5a62';
    mctx.lineWidth = 3;
    for (const c of CITY.roadAt) {
      mctx.beginPath();
      mctx.moveTo((c + 280) * scale, 0);
      mctx.lineTo((c + 280) * scale, size);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(0, (c + 280) * scale);
      mctx.lineTo(size, (c + 280) * scale);
      mctx.stroke();
    }
    const dot = (x, z, color, r) => {
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.arc((x + 280) * scale, (z + 280) * scale, r, 0, Math.PI * 2);
      mctx.fill();
    };
    // Mission target.
    const target = world.missions.target;
    if (target) dot(target.x, target.z, '#40d080', 5);
    // Traffic.
    for (const car of world.traffic.cars) {
      dot(car.mesh.position.x, car.mesh.position.z, '#d8d8d8', 2.5);
    }
    // Cops.
    for (const cop of world.police.cops) {
      dot(cop.x, cop.z, '#ff4040', 3);
    }
    // Player arrow.
    const px = (world.player.x + 280) * scale;
    const pz = (world.player.z + 280) * scale;
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(-world.player.yaw);
    mctx.fillStyle = '#ffd27a';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 6);
    mctx.lineTo(-5, 6);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    mctx.restore();
    // Ring.
    mctx.strokeStyle = '#d8d8d8';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    mctx.stroke();
  }

  return {
    update(world, radioName) {
      const player = world.player;
      el('cash').textContent = '$' + player.cash;
      el('stars').textContent = starsText(world.police.wanted);
      el('speed').textContent = player.speedKmh + ' km/h';
      el('radio').textContent = radioName;
      el('clock').textContent = clockText(world.clockMinutes);
      el('health-fill').style.width = player.health + '%';
      el('mission-title').textContent = world.missions.allDone
        ? 'All Jobs Done'
        : world.missions.mission.title;
      el('mission-objective').textContent = world.missions.objectiveText;
      el('toast').textContent = world.toast;
      const hint = world.nearShop
        ? `Press E — ${world.nearShop.name}: ${world.nearShop.blurb} ($${world.nearShop.price})`
        : '';
      el('hint').textContent = hint;
      drawMinimap(world);
    },
    show(id) {
      el(id).classList.remove('hidden');
    },
    hide(id) {
      el(id).classList.add('hidden');
    },
    isHidden(id) {
      return el(id).classList.contains('hidden');
    },
  };
}
