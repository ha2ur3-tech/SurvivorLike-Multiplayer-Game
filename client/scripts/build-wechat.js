const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "minigame", "js");

fs.mkdirSync(outDir, { recursive: true });

async function buildAll() {
  // 1) Build Phaser runtime into its own file, injecting `window/document` bindings
  // so Phaser doesn't crash in WeChat's CommonJS-like wrapper.
  await esbuild.build({
    entryPoints: [path.resolve(root, "src", "phaser-runtime.ts")],
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["es2020"],
    sourcemap: false,
    minify: true,
    banner: {
      js: [
        "var window = (typeof window !== 'undefined') ? window : globalThis;",
        "var document = window.document || (window.document = window.document || {});"
      ].join("")
    },
    mainFields: ["browser", "module", "main"],
    conditions: ["browser", "default"],
    outfile: path.resolve(outDir, "phaser.runtime.js")
  });

  // 2) Build game logic bundle (small)
  await esbuild.build({
    entryPoints: [path.resolve(root, "src", "main.ts")],
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["es2020"],
    sourcemap: false,
    minify: true,
    mainFields: ["browser", "module", "main"],
    conditions: ["browser", "default"],
    outfile: path.resolve(outDir, "bundle.js")
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

