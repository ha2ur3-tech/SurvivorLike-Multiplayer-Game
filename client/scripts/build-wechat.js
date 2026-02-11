const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "minigame", "js");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

esbuild
  .build({
    entryPoints: [path.resolve(root, "src", "main.ts")],
    bundle: true,
    platform: "neutral",
    format: "cjs",
    target: ["es2020"],
    sourcemap: false,
    minify: true,
    outfile: path.resolve(outDir, "bundle.js")
  })
  .catch((err) => {
  console.error(err);
  process.exit(1);
});

