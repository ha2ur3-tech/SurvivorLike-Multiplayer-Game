import Phaser from "./phaser-global";
import { initWechatPolyfill } from "./wechat/polyfill";
import { GAME_H, GAME_W } from "./game/constants";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { RoomScene } from "./game/scenes/RoomScene";
import { GameScene } from "./game/scenes/GameScene";

const { canvas } = initWechatPolyfill();

// Note: In WeChat minigame, canvas is provided by wx.createCanvas().
// In devtools or non-wechat environment, Phaser will create one automatically.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#0b1020",
  canvas: canvas as any,
  parent: undefined,
  scene: [BootScene, MainMenuScene, RoomScene, GameScene],
  audio: {
    // v0: disable audio to avoid WebAudio/DOM adapter issues in minigame runtime.
    noAudio: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  fps: {
    target: 60,
    forceSetTimeOut: false
  }
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

