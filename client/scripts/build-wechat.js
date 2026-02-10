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
        ,
        // Bind DOM-like constructors into local scope to avoid ReferenceError in WeChat runtime.
        "var HTMLElement = window.HTMLElement || function HTMLElement() {};",
        "var HTMLCanvasElement = window.HTMLCanvasElement || function HTMLCanvasElement() {};",
        "var HTMLImageElement = window.HTMLImageElement || function HTMLImageElement() {};",
        "var OffscreenCanvas = window.OffscreenCanvas || HTMLCanvasElement;",
        "var CanvasRenderingContext2D = window.CanvasRenderingContext2D || function CanvasRenderingContext2D() {};",
        "var navigator = window.navigator || (window.navigator = { userAgent: 'wechat-minigame', maxTouchPoints: 10 });",
        "var location = window.location || (window.location = { href: 'wxgame://local' });",
        "var performance = window.performance || (window.performance = { now: function(){ return Date.now(); } });"
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

