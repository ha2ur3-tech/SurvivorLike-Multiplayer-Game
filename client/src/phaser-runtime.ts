// This entry exists solely to produce `minigame/js/phaser.runtime.js`.
// It loads Phaser via bundler (from npm package), then exposes it as global `Phaser`.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PhaserLib = require("phaser");

// Expose global for the rest of the game bundle.
(globalThis as any).Phaser = PhaserLib;

