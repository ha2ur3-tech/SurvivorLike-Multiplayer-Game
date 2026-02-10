import Phaser from "phaser";
import { GAME_H, GAME_W, COLORS } from "../constants";
import { makeLabel } from "../ui/widgets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    makeLabel(this, GAME_W / 2, GAME_H / 2, "加载中…", 32);
    // v0: no assets, jump immediately
    this.time.delayedCall(50, () => this.scene.start("MainMenu"));
  }
}

