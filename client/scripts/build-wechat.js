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
    // WeChat Mini Game JS runtime (and preview pipeline) may not support optional chaining / nullish coalescing.
    // Build down to a more compatible target and force transforms.
    target: ["es2017"],
    supported: {
      "optional-chain": false,
      "nullish-coalescing": false
    },
    sourcemap: false,
    minify: true,
    outfile: path.resolve(outDir, "bundle.js")
  })
  .catch((err) => {
  console.error(err);
  process.exit(1);
});

