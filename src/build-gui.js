// Build the GUI: copy sources from src/gui/ into gui/ (build output) and
// export the SQLite snapshot the app can fall back to when served
// statically. Run before serving or committing a release snapshot:
//
//   node src/build-gui.js        # copy sources + export gui/data.json
//   node src/build-gui.js docs   # also render docs/results.html
//
// gui/ stays gitignored (build output), src/gui/ is the tracked source.

import { mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

mkdirSync("gui", { recursive: true });
for (const file of readdirSync("src/gui")) {
  copyFileSync(`src/gui/${file}`, `gui/${file}`);
  console.log(`copied ${file} -> gui/`);
}

execFileSync("node", ["src/exports.js", ...process.argv.slice(2)], { stdio: "inherit" });
