import Phaser from "../../phaser-global";
import { GAME_H, GAME_W, COLORS } from "../constants";
import { makeButton, makeLabel, makePanel } from "../ui/widgets";
import { clientState, PlayerInfo } from "../state/clientState";

const CHAR_IDS = ["char_0", "char_1", "char_2", "char_3", "char_4"];

export class RoomScene extends Phaser.Scene {
  private selectedIdx = 0;

  constructor() {
    super("Room");
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const room = clientState.room;
    if (!room) {
      this.scene.start("MainMenu");
      return;
    }

    makeLabel(this, GAME_W / 2, 110, `房间号：${room.roomCode}`, 36);

    // Left player list (4 lines)
    const listX = 130;
    const listY = GAME_H / 2 - 40;
    makePanel(this, listX, listY, 240, 520, 0.55);
    makeLabel(this, listX, listY - 240, "玩家", 26).setColor(`#${COLORS.muted.toString(16).padStart(6, "0")}`);

    for (let i = 0; i < room.maxPlayers; i++) {
      const y = listY - 160 + i * 110;
      this.drawPlayerRow(listX, y, room.players[i], i);
    }

    // Character select
    const cx = GAME_W / 2 + 130;
    const cy = GAME_H / 2 - 40;
    makePanel(this, cx, cy, 520, 520, 0.55);
    makeLabel(this, cx, cy - 240, "选择角色", 26).setColor(`#${COLORS.muted.toString(16).padStart(6, "0")}`);

    const left = makeButton(this, cx - 200, cy, 70, 70, "<", () => this.changeChar(-1));
    const right = makeButton(this, cx + 200, cy, 70, 70, ">", () => this.changeChar(+1));

    const card = this.add.rectangle(cx, cy, 260, 260, COLORS.panel2, 1).setStrokeStyle(2, 0xffffff, 0.15);
    const name = makeLabel(this, cx, cy + 160, "角色 1", 28);

    const renderChar = () => {
      const id = CHAR_IDS[this.selectedIdx];
      name.setText(`角色 ${this.selectedIdx + 1}`);
      // simple placeholder color
      const color = [0x6ee7ff, 0x4dff88, 0xffd34d, 0xff6ef3, 0xff5a5a][this.selectedIdx % 5];
      card.setFillStyle(color, 0.35);
      this.setLocalCharacter(id);
    };
    renderChar();

    // Host / Guest button
    const isHost = room.hostId === clientState.localPlayerId;
    const btn = makeButton(this, cx, cy + 250, 360, 78, isHost ? "开始游戏" : "准备", () => {
      if (isHost) {
        // v0: allow start if all guests ready
        const allReady = room.players.every((p) => p == null || p.isReady);
        if (!allReady) return;
        this.scene.start("Game");
        return;
      }
      this.toggleLocalReady();
      this.scene.restart();
    });

    if (isHost) {
      // Host is always ready
      btn.label.setText("开始游戏");
    }

    // Back
    makeButton(this, 110, 60, 160, 56, "返回", () => {
      clientState.room = undefined;
      this.scene.start("MainMenu");
    });

    left.container.setDepth(2);
    right.container.setDepth(2);
  }

  private drawPlayerRow(x: number, y: number, p: PlayerInfo | undefined, idx: number) {
    const row = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 220, 90, COLORS.panel2, 0.85).setStrokeStyle(2, 0xffffff, 0.08);
    row.add(bg);

    if (!p) {
      const avatar = this.add.rectangle(-70, 0, 56, 56, 0x777777, 0.55).setStrokeStyle(2, 0xffffff, 0.12);
      const plus = makeLabel(this, -70, 0, "+", 40);
      row.add([avatar, plus]);
      const name = makeLabel(this, 10, -10, "--", 26).setOrigin(0, 0.5);
      name.setX(-35);
      row.add(name);

      avatar.setInteractive();
      avatar.on("pointerup", () => {
        // v0: just show tip; later wire to wx.shareAppMessage with roomCode
        const tip = makeLabel(this, GAME_W / 2, GAME_H - 140, "邀请功能：后续接入微信分享卡片（带 roomCode）", 22).setColor(
          `#${COLORS.muted.toString(16).padStart(6, "0")}`
        );
        this.time.delayedCall(1200, () => tip.destroy());
      });
      return;
    }

    const isLocal = p.isLocal;
    const avatar = this.add.rectangle(-70, 0, 56, 56, isLocal ? COLORS.accent : 0xffffff, 0.25).setStrokeStyle(
      2,
      0xffffff,
      0.12
    );
    row.add(avatar);

    const name = makeLabel(this, -35, -10, p.name, 24).setOrigin(0, 0.5);
    name.setColor(`#${COLORS.text.toString(16).padStart(6, "0")}`);
    row.add(name);

    const ready = makeLabel(this, -35, 22, p.isReady ? "已准备" : "未准备", 22).setOrigin(0, 0.5);
    ready.setColor(`#${(p.isReady ? COLORS.ok : COLORS.danger).toString(16).padStart(6, "0")}`);
    row.add(ready);

    // Fill empty slots below if needed
    const room = clientState.room;
    if (room && room.players.length < room.maxPlayers) {
      for (let i = room.players.length; i < room.maxPlayers; i++) {
        // noop
      }
    }

    row.setDepth(1 + idx * 0.01);
  }

  private changeChar(delta: number) {
    this.selectedIdx = (this.selectedIdx + delta + CHAR_IDS.length) % CHAR_IDS.length;
    this.scene.restart();
  }

  private setLocalCharacter(id: string) {
    const room = clientState.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === clientState.localPlayerId);
    if (!me) return;
    me.characterId = id;
  }

  private toggleLocalReady() {
    const room = clientState.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === clientState.localPlayerId);
    if (!me) return;
    me.isReady = !me.isReady;
  }
}

