import type * as PhaserNS from "phaser";

// In WeChat Mini Game runtime, Phaser will be loaded as a global (from `phaser.min.js`).
export const Phaser = (globalThis as any).Phaser as typeof PhaserNS;

export default Phaser;

