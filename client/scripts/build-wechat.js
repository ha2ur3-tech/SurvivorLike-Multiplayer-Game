const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "minigame", "js");

fs.mkdirSync(outDir, { recursive: true });

// Copy Phaser runtime (global build) to keep our bundle small.
let phaserSrc;
try {
  const phaserPkgJson = require.resolve("phaser/package.json", { paths: [root] });
  const phaserDir = path.dirname(phaserPkgJson);
  phaserSrc = path.resolve(phaserDir, "dist", "phaser.min.js");
} catch (e) {
  // fallback for workspace-hoisted node_modules
  phaserSrc = path.resolve(root, "..", "node_modules", "phaser", "dist", "phaser.min.js");
}
const phaserDst = path.resolve(outDir, "phaser.min.js");
try {
  fs.copyFileSync(phaserSrc, phaserDst);
} catch (e) {
  console.warn("Warning: failed to copy phaser.min.js:", e?.message || e);
}

esbuild
  .build({
    entryPoints: [path.resolve(root, "src", "main.ts")],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: ["es2020"],
    // WeChat DevTools may fail/lag when a single JS file is too large.
    // Keep this bundle small and minified.
    sourcemap: false,
    minify: true,
    mainFields: ["browser", "module", "main"],
    conditions: ["browser", "default"],
    outfile: path.resolve(outDir, "bundle.js")
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

