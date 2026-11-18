// Solmar Bay — keyboard and mouse: held keys, edge-triggered presses, and
// drag-to-orbit for the chase camera.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    orbitDX: 0,
    orbitDY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    consumePressed(code) {
      const hit = this.pressed.has(code);
      if (hit) this.pressed.delete(code);
      return hit;
    },
    clearPressed() {
      this.pressed.clear();
    },
    consumeOrbit() {
      const dx = this.orbitDX;
      const dy = this.orbitDY;
      this.orbitDX = 0;
      this.orbitDY = 0;
      return { dx, dy };
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.orbitDX += e.clientX - input.lastX;
    input.orbitDY += e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.dragging = false;
  });

  return input;
}
