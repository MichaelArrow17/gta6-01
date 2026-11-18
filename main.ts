// Sunset Heat: Solmar Bay — entry program for the make.fun gta6-01 bounty.
// Node 22, standard library only. It takes this repository's game/ folder and
// screenshots/ folder, copies them into the output directory the grader reads
// (or MAKEFUN_OUTPUT_DIR when run outside the grader), and writes the dossier
// the judge reads, using the kit's vendored makefun-game library.
//
// Run it like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice into two different directories: the two outputs must be identical.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the gate so a local run refuses what the scorer would refuse:
// at most 4 screenshots, each at most 256 KiB; game/ at most 993 entries and
// 48 MiB in total, no path under game/ longer than 1000 bytes; the dossier's
// source text is capped at 160 KiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
