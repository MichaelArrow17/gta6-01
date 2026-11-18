# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/MichaelArrow17/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/MichaelArrow17/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the make.fun bounty **"GTA 6"** (`gta6-01`, $1,666).

**Sunset Heat: Solmar Bay** — an open-world crime game (three.js / HTML5, fully
offline in a desktop browser). A sunset coastal 3D city with a chase camera,
6 story missions (Rae Calloway, getaway driver for fixer Dario Venn and Lena
Cross), a wanted system (0–5 stars) with police cars and a helicopter at 3+,
carjacking (E), punch + pistol combat, traffic and pedestrians, 3 shops
(food / ammo / spray), 3 procedural WebAudio radio stations, localStorage
save, and a HUD with cash, stars, health, speed, a circular minimap and a
mission banner.

## Play

Open `game/index.html` in a desktop browser (or run `serve.ts` and open the
served page). WASD to move/drive, E to steal a car or enter a shop, F to
punch, click to shoot, Shift to run, M for the next job, R for the radio,
P to pause, drag the mouse to move the camera.

## Layout

- `game/` — the game (14 modules under `game/src/`, `game/index.html`,
  vendored three.js r160 under `game/vendor/`).
- `screenshots/` — the 4 staged screenshots (title, drive, chase, mission).
- `main.ts` — the entry point that produces the submission dossier
  (deterministic: two runs are byte-identical).
- `serve.ts` — the local static server used for testing.
