// The HUD: cash, wanted stars, health, speed, the mission banner, the radio
// station, toast messages, and the minimap — a live top-down map of Solmar
// Bay drawn on a 2D canvas, with the player, the cops, traffic and the
// mission marker on it. Also the title, pause, busted and mission-complete
// panels, which are plain DOM so they read crisply in a screenshot.
import { RADIO_STATIONS } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud() {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const size = minimap.width;
  const scale = size / 280; // world -140..140 maps onto the canvas
  const toMap = (x, z) => [(x + 140) * scale, (z + 140) * scale];

  let toastTimer = null;

  function drawMinimap(state) {
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = '#20242e';
    mctx.fillRect(0, 0, size, size);
    // Ocean (west edge).
    mctx.fillStyle = '#1e6f8e';
    const [ox] = toMap(-140, 0);
    mctx.fillRect(0, 0, toMap(-112, 0)[0], size);
    // Beach.
    mctx.fillStyle = '#e8c98f';
    mctx.fillRect(toMap(-112, 0)[0], 0, toMap(-104, 0)[0] - toMap(-112, 0)[0], size);
    // Roads.
    mctx.strokeStyle = '#565b66';
    mctx.lineWidth = 5;
    for (let v = -96; v <= 96; v += 32) {
      const [ax, ay] = toMap(v, -140);
      const [bx, by] = toMap(v, 140);
      mctx.beginPath(); mctx.moveTo(ax, ay); mctx.lineTo(bx, by); mctx.stroke();
      const [cx, cy] = toMap(-140, v);
      const [dx, dy] = toMap(140, v);
      mctx.beginPath(); mctx.moveTo(cx, cy); mctx.lineTo(dx, dy); mctx.stroke();
    }
    // Park.
    mctx.fillStyle = '#7da05c';
    const [px, py] = toMap(16 - 13, 16 - 13);
    mctx.fillRect(px, py, 26 * scale, 26 * scale);
    // Mission marker.
    const target = state.missionTarget;
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      mctx.fillStyle = '#f2c94c';
      mctx.beginPath();
      mctx.moveTo(mx, my - 7); mctx.lineTo(mx + 7, my); mctx.lineTo(mx, my + 7); mctx.lineTo(mx - 7, my);
      mctx.closePath(); mctx.fill();
    }
    // Traffic.
    mctx.fillStyle = '#c8ccd4';
    for (const car of state.traffic) {
      const [cx, cy] = toMap(car.x, car.z);
      mctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Parked cars (stealable): the minimap used to show traffic only, so
    // a player hunting for a car in mission 1 had no idea where to look.
    mctx.fillStyle = '#8fa3b8';
    for (const car of state.parked || []) {
      if (car.health <= 0) continue;
      const [cx, cy] = toMap(car.x, car.z);
      mctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Cops.
    mctx.fillStyle = '#ff3b30';
    for (const cop of state.cops) {
      const [cx, cy] = toMap(cop.x, cop.z);
      mctx.beginPath(); mctx.arc(cx, cy, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const [ux, uy] = toMap(state.player.x, state.player.z);
    mctx.save();
    mctx.translate(ux, uy);
    mctx.rotate(state.player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6);
    mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  function stars(wanted) {
    let text = '';
    for (let i = 0; i < 5; i += 1) text += i < wanted ? '★' : '☆';
    return text;
  }

  function update(state) {
    el('cash').textContent = `$${state.cash.toLocaleString('en-US')}`;
    const starEl = el('stars');
    starEl.textContent = stars(state.wanted);
    starEl.classList.toggle('hot', state.wanted > 0);
    el('health-bar').style.width = `${Math.max(0, state.player.health)}%`;
    el('health-num').textContent = `${Math.max(0, Math.round(state.player.health))}`;
    el('ammo').textContent = `Ammo ${state.player.ammo}`;
    el('speed').textContent = state.player.inCar
      ? `${Math.round(Math.abs(state.player.speed) * 3.6)} km/h`
      : (state.player.inCar === null && state.onFootRun ? 'RUNNING' : 'ON FOOT');
    const mission = state.mission;
    if (mission) {
      el('mission-title').textContent = `${mission.title} — ${mission.giver}`;
      el('mission-objective').textContent = state.objectiveText || '';
      el('mission-timer').textContent = state.timer > 0 ? `⏱ ${Math.ceil(state.timer)}s` : '';
    } else {
      el('mission-title').textContent = 'Free roam — Solmar Bay';
      el('mission-objective').textContent = 'Press M to start the next job. Steal a car with E.';
      el('mission-timer').textContent = '';
    }
    el('radio').textContent = `♪ ${RADIO_STATIONS[state.station].name}`;
    el('clock').textContent = state.clock;
    drawMinimap(state);
  }

  function toast(message, ms = 3200) {
    const t = el('toast');
    t.textContent = message;
    t.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  function show(id) {
    for (const panel of ['title-screen', 'pause-screen', 'busted-screen', 'mission-screen', 'gameover-screen']) {
      el(panel).classList.toggle('hidden', panel !== id);
    }
    el('hud').classList.toggle('hidden', id === 'title-screen');
  }
  function hideAll() {
    for (const panel of ['title-screen', 'pause-screen', 'busted-screen', 'mission-screen', 'gameover-screen']) {
      el(panel).classList.add('hidden');
    }
    el('hud').classList.remove('hidden');
  }

  return { update, toast, show, hideAll };
}
