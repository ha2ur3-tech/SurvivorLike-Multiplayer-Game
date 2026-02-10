import Phaser from "../../phaser-global";
import { GAME_H, GAME_W, COLORS } from "../constants";
import { makeButton, makeLabel } from "../ui/widgets";

export class GameScene extends Phaser.Scene {
  private elapsedSec = 0;
  private timerText!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
  }

  create() {
    this.cameras.main.setBackgroundColor(0x081018);
    makeLabel(this, GAME_W / 2, 120, "局内占位场景（下一步接入联机与玩法）", 26).setColor(
      `#${COLORS.muted.toString(16).padStart(6, "0")}`
    );

    this.timerText = makeLabel(this, GAME_W / 2, 60, "00:00", 30);

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.elapsedSec += 1;
        const mm = String(Math.floor(this.elapsedSec / 60)).padStart(2, "0");
        const ss = String(this.elapsedSec % 60).padStart(2, "0");
        this.timerText.setText(`${mm}:${ss}`);
      }
    });

    makeButton(this, GAME_W / 2, GAME_H - 120, 360, 78, "结束（回房间）", () => this.scene.start("Room"));
  }
}

