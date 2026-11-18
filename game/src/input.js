// Keyboard and mouse input. Held keys give movement; one-shot presses (enter
// a car, punch, shoot, pause, start a mission, change radio) are queued as
// edge flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. Dragging the mouse orbits the camera.
export const EDGE_ENTER = 1;
export const EDGE_PUNCH = 2;
export const EDGE_SHOOT = 4;
export const EDGE_PAUSE = 8;
export const EDGE_CONFIRM = 16;
export const EDGE_MISSION = 32;
export const EDGE_RADIO = 64;
export const EDGE_MUTE = 128;

export function createInput(canvas) {
  const held = new Set();
  let edges = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let lastClickX = 0;
  let lastClickY = 0;
  let hasClick = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyE') edges |= EDGE_ENTER;
    else if (event.code === 'KeyF') edges |= EDGE_PUNCH;
    else if (event.code === 'KeyM') edges |= EDGE_MISSION;
    else if (event.code === 'KeyR') edges |= EDGE_RADIO;
    else if (event.code === 'KeyN') edges |= EDGE_MUTE;
    else if (event.code === 'KeyP' || event.code === 'Escape') edges |= EDGE_PAUSE;
    else if (event.code === 'Enter' || event.code === 'Space') edges |= EDGE_CONFIRM;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    lastClickX = event.clientX;
    lastClickY = event.clientY;
    hasClick = true;
    if (event.button === 0) {
      edges |= EDGE_SHOOT;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  // A click anywhere is also a confirm. The menu panels cover the canvas,
  // so a click on the title screen never reaches the canvas handler — yet
  // the title says "Press Enter or click to start". Without this, clicking
  // to start (or to resume, or to get back out after being busted) did
  // nothing at all. In play the confirm edge is ignored, so a click there
  // still only shoots.
  window.addEventListener('pointerdown', () => { edges |= EDGE_CONFIRM; });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitDX += event.clientX - lastX;
    orbitDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  function axis(neg, pos) {
    return (held.has(pos) ? 1 : 0) - (held.has(neg) ? 1 : 0);
  }

  return {
    // -1..1 forward (W / Up) and strafe (D / Right), run while Shift held.
    read() {
      return {
        forward: axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp'),
        strafe: axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    takeEdges() {
      const taken = edges;
      edges = 0;
      return taken;
    },
    takeOrbit() {
      const dx = orbitDX;
      const dy = orbitDY;
      orbitDX = 0;
      orbitDY = 0;
      return { dx, dy };
    },
    // Where the last click landed (viewport pixels), for aiming a shot at
    // the cursor instead of just where Rae happens to face.
    lastClick() {
      return hasClick ? { x: lastClickX, y: lastClickY } : null;
    },
  };
}
