import Phaser from "../../phaser-global";
import { GAME_H, GAME_W, COLORS } from "../constants";
import { makeButton, makeLabel, makePanel } from "../ui/widgets";
import { clientState } from "../state/clientState";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    makeLabel(this, GAME_W / 2, 150, "SurvivorLike（联机原型）", 42);

    makePanel(this, GAME_W / 2, GAME_H / 2 - 60, 560, 420, 0.55);
    makeLabel(this, GAME_W / 2, GAME_H / 2 - 210, "主菜单", 34);

    const btn1 = makeButton(this, GAME_W / 2, GAME_H / 2 - 70, 360, 78, "开始游戏（创建房间）", () => {
      // v0: offline stub (until server is wired)
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      clientState.room = {
        roomCode,
        hostId: clientState.localPlayerId,
        players: [
          {
            id: clientState.localPlayerId,
            name: clientState.localName,
            isLocal: true,
            isReady: true,
            characterId: "char_0"
          }
        ],
        maxPlayers: 4,
        phase: "lobby"
      };
      this.scene.start("Room");
    });

    makeButton(this, GAME_W / 2, GAME_H / 2 + 40, 360, 78, "加入房间", () => this.openJoinModal());

    makeLabel(this, GAME_W / 2, GAME_H - 90, "v0：先跑通 UI 与流程，联机服务端下一步接入", 22).setColor(
      `#${COLORS.muted.toString(16).padStart(6, "0")}`
    );

    btn1.container.setDepth(2);
  }

  private openJoinModal() {
    const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.6);
    const panel = makePanel(this, GAME_W / 2, GAME_H / 2, 600, 360, 0.9);
    const title = makeLabel(this, GAME_W / 2, GAME_H / 2 - 130, "加入房间", 34);
    const hint = makeLabel(this, GAME_W / 2, GAME_H / 2 - 70, "请输入六位房间号", 24).setColor(
      `#${COLORS.muted.toString(16).padStart(6, "0")}`
    );
    const inputBg = this.add.rectangle(GAME_W / 2, GAME_H / 2 - 10, 420, 56, COLORS.panel2, 1).setStrokeStyle(2, 0xffffff, 0.15);
    const inputText = makeLabel(this, GAME_W / 2, GAME_H / 2 - 10, "", 30);

    let value = "";
    const update = () => {
      inputText.setText(value);
      hint.setVisible(value.length === 0);
    };
    update();

    // Simple keyboard input in devtools; on device we can replace with wx.showKeyboard later.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (!overlay.active) return;
      if (e.key === "Backspace") value = value.slice(0, -1);
      else if (/^\d$/.test(e.key) && value.length < 6) value += e.key;
      else if (e.key === "Enter") onConfirm();
      update();
    });

    const onClose = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      hint.destroy();
      inputBg.destroy();
      inputText.destroy();
      cancel.container.destroy();
      ok.container.destroy();
      errorText.destroy();
    };

    const errorText = makeLabel(this, GAME_W / 2, GAME_H / 2 + 55, "", 22).setColor(
      `#${COLORS.danger.toString(16).padStart(6, "0")}`
    );

    const cancel = makeButton(this, GAME_W / 2 - 110, GAME_H / 2 + 120, 180, 64, "取消", onClose);
    const onConfirm = () => {
      if (value.length !== 6) {
        errorText.setText("房间号必须是 6 位数字");
        return;
      }
      // v0：离线加入模拟。联机接入后改为查询/加入。
      clientState.room = {
        roomCode: value,
        hostId: "host",
        players: [
          { id: "host", name: "房主", isLocal: false, isReady: true, characterId: "char_0" },
          { id: clientState.localPlayerId, name: clientState.localName, isLocal: true, isReady: false, characterId: "char_0" }
        ],
        maxPlayers: 4,
        phase: "lobby"
      };
      this.scene.start("Room");
      onClose();
    };
    const ok = makeButton(this, GAME_W / 2 + 110, GAME_H / 2 + 120, 180, 64, "确定", onConfirm);

    overlay.setInteractive();
    overlay.on("pointerup", () => {
      // clicking outside does nothing in v0, keep modal strict
    });
  }
}

