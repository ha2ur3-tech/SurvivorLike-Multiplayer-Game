const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "minigame", "js");

fs.mkdirSync(outDir, { recursive: true });

esbuild
  .build({
    entryPoints: [path.resolve(root, "src", "main.ts")],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: ["es2020"],
    sourcemap: true,
    mainFields: ["browser", "module", "main"],
    conditions: ["browser", "default"],
    outfile: path.resolve(outDir, "bundle.js")
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

