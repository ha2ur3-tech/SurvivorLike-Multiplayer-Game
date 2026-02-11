/* eslint-disable @typescript-eslint/no-explicit-any */
// WeChat Mini Game native-canvas UI (no Phaser, no DOM adapters).
// Goal: make the project boot reliably and show MainMenu/JoinRoom/Room screens first.

declare const wx: any;

type AppScreen = "menu" | "join" | "room" | "ingame" | "server";

type PlayerRow = {
  name: string;
  ready: boolean;
  isLocal: boolean;
};

type RoomState = {
  code: string;
  meReady: boolean;
  players: (PlayerRow | null)[]; // 4 slots
  characterIndex: number;
  hostId: string;
};

const LOGICAL_W = 720;
const LOGICAL_H = 1280;

const COLORS = {
  bg: "#0b1020",
  panel: "rgba(19,32,58,0.85)",
  panel2: "rgba(15,26,49,0.95)",
  text: "#e8eefc",
  muted: "#9fb0d0",
  accent: "#4aa3ff",
  danger: "#ff5a5a",
  ok: "#4dff88"
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

class Button {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public text: string,
    public onClick: () => void,
    public enabled = true
  ) {}

  hit(px: number, py: number) {
    return this.enabled && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    roundRect(ctx, this.x, this.y, this.w, this.h, 14);
    ctx.fillStyle = this.enabled ? COLORS.accent : "rgba(74,163,255,0.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = "600 28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2);
    ctx.restore();
  }
}

class App {
  private canvas: any;
  private ctx: CanvasRenderingContext2D;
  private screen: AppScreen = "menu";
  private joinInput = "";
  private room: RoomState | null = null;
  private clientId: string | null = null;
  private ws: import("./net/wsClient").WsClient | null = null;
  private netError: string | null = null;
  private connecting = false;
  private serverHost = "127.0.0.1";
  private serverHostInput = "";
  private lastTap?: { x: number; y: number; t: number };

  private viewW = 375;
  private viewH = 667;
  private dpr = 2;
  private scale = 1;
  private offX = 0;
  private offY = 0;

  private buttons: Button[] = [];

  constructor() {
    const sys = wx.getSystemInfoSync();
    this.viewW = sys.windowWidth;
    this.viewH = sys.windowHeight;
    this.dpr = sys.pixelRatio || 2;

    this.canvas = wx.createCanvas();
    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);
    this.ctx = this.canvas.getContext("2d");

    this.recalcViewport();

    // Touch handling: DevTools / device may provide different coordinate fields.
    const onTapEvent = (e: any) => {
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
      const xy = this.extractXY(t);
      if (!xy) return;
      const p = this.toLogical(xy.x, xy.y);
      this.lastTap = { x: p.x, y: p.y, t: Date.now() };
      this.handleTap(p.x, p.y);
    };
    // Some environments only fire touchend reliably for clicks.
    wx.onTouchStart?.(onTapEvent);
    wx.onTouchEnd?.(onTapEvent);

    this.applyLaunchQuery(wx.getLaunchOptionsSync?.()?.query);
    wx.onShow?.((e: any) => this.applyLaunchQuery(e?.query));

    // Load server host from storage (only host part, easier for mobile input).
    const host = wx.getStorageSync?.("serverHost");
    if (host) this.serverHost = String(host);

    this.loop();
  }

  private serverUrl() {
    const host = this.serverHost || "127.0.0.1";
    return `ws://${host}:2567/ws`;
  }

  private applyLaunchQuery(query: any) {
    if (!query) return;
    const roomCode = query.roomCode ? String(query.roomCode) : "";
    if (/^\d{6}$/.test(roomCode)) {
      this.joinInput = roomCode;
      this.screen = "join";
      // auto-join once if not already in room
      if (!this.room && !this.connecting) {
        this.connectAndJoin(roomCode);
      }
    }
  }

  private recalcViewport() {
    this.scale = Math.min(this.viewW / LOGICAL_W, this.viewH / LOGICAL_H);
    this.offX = (this.viewW - LOGICAL_W * this.scale) / 2;
    this.offY = (this.viewH - LOGICAL_H * this.scale) / 2;
  }

  private toLogical(x: number, y: number) {
    return {
      x: (x - this.offX) / this.scale,
      y: (y - this.offY) / this.scale
    };
  }

  private extractXY(t: any): { x: number; y: number } | null {
    let x: any = t?.x;
    let y: any = t?.y;
    if (typeof x !== "number") x = t?.clientX ?? t?.pageX ?? t?.screenX;
    if (typeof y !== "number") y = t?.clientY ?? t?.pageY ?? t?.screenY;
    if (typeof x !== "number" || typeof y !== "number") return null;

    // Some runtimes provide touch coordinates in physical pixels (scaled by DPR).
    if (x > this.viewW + 1 || y > this.viewH + 1) {
      x = x / this.dpr;
      y = y / this.dpr;
    }
    return { x, y };
  }

  private setTransform() {
    // map logical coords to real canvas pixels
    const s = this.scale * this.dpr;
    this.ctx.setTransform(s, 0, 0, s, this.offX * this.dpr, this.offY * this.dpr);
  }

  private loop = () => {
    this.render();
    wx.nextTick?.(() => {}); // keep runtime happy
    const raf = (globalThis as any).requestAnimationFrame ?? ((cb: any) => setTimeout(() => cb(Date.now()), 16));
    raf(this.loop);
  };

  private handleTap(x: number, y: number) {
    for (const b of this.buttons) {
      if (b.hit(x, y)) {
        b.onClick();
        return;
      }
    }
  }

  private render() {
    // clear full physical canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.setTransform();
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.buttons = [];
    if (this.screen === "menu") this.renderMenu();
    else if (this.screen === "join") this.renderJoin();
    else if (this.screen === "room") this.renderRoom();
    else if (this.screen === "server") this.renderServer();
    else this.renderInGame();

    // dev hint: show last tap coords (helps debug "can't click")
    if (this.lastTap && Date.now() - this.lastTap.t < 1500) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(this.ctx, 20, LOGICAL_H - 90, 320, 60, 10);
      this.ctx.fill();
      this.ctx.fillStyle = COLORS.muted;
      this.ctx.font = "500 18px Arial";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`tap: ${this.lastTap.x.toFixed(0)}, ${this.lastTap.y.toFixed(0)}`, 40, LOGICAL_H - 60);
      this.ctx.restore();
    }
  }

  private title(text: string, y: number) {
    this.ctx.save();
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = "700 44px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, LOGICAL_W / 2, y);
    this.ctx.restore();
  }

  private panel(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    roundRect(this.ctx, x, y, w, h, 18);
    this.ctx.fillStyle = COLORS.panel;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.10)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderMenu() {
    this.title("SurvivorLike", 160);

    this.panel(80, 260, 560, 420);
    this.ctx.save();
    this.ctx.fillStyle = COLORS.muted;
    this.ctx.font = "500 22px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("v0：先把界面与流程跑通（无 Phaser）", LOGICAL_W / 2, 330);
    this.ctx.restore();

    const start = new Button(180, 400, 360, 82, "开始游戏（创建房间）", () => this.connectAndCreate());
    const join = new Button(180, 510, 360, 82, "加入房间", () => {
      this.joinInput = "";
      this.screen = "join";
    });
    const server = new Button(180, 620, 360, 70, "服务器设置", () => {
      this.serverHostInput = this.serverHost;
      this.screen = "server";
    });
    // net hint
    this.ctx.save();
    this.ctx.fillStyle = this.netError ? COLORS.danger : COLORS.muted;
    this.ctx.font = "500 20px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      this.connecting ? "正在连接服务器…" : this.netError ? `网络错误：${this.netError}` : `服务器：${this.serverUrl()}`,
      LOGICAL_W / 2,
      650
    );
    this.ctx.restore();

    this.buttons.push(start, join, server);
    start.draw(this.ctx);
    join.draw(this.ctx);
    server.draw(this.ctx);
  }

  private renderJoin() {
    this.title("加入房间", 160);
    this.panel(60, 230, 600, 720);

    // input box
    this.ctx.save();
    roundRect(this.ctx, 140, 290, 440, 68, 12);
    this.ctx.fillStyle = COLORS.panel2;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = this.joinInput.length ? COLORS.text : COLORS.muted;
    this.ctx.font = "600 30px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(this.joinInput.length ? this.joinInput : "请输入六位房间号", LOGICAL_W / 2, 324);
    this.ctx.restore();

    // keypad
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "确定"];
    const startX = 140;
    const startY = 400;
    const gap = 14;
    const bw = 132;
    const bh = 82;
    for (let i = 0; i < keys.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = startX + col * (bw + gap);
      const y = startY + row * (bh + gap);
      const label = keys[i];
      const enabled = label !== "确定" || this.joinInput.length === 6;
      const b = new Button(
        x,
        y,
        bw,
        bh,
        label,
        () => {
          if (label === "⌫") this.joinInput = this.joinInput.slice(0, -1);
          else if (label === "确定") this.connectAndJoin(this.joinInput);
          else if (this.joinInput.length < 6) this.joinInput += label;
        },
        enabled
      );
      this.buttons.push(b);
      b.draw(this.ctx);
    }

    const cancel = new Button(140, 860, 210, 72, "取消", () => (this.screen = "menu"));
    this.buttons.push(cancel);
    cancel.draw(this.ctx);
  }

  private renderServer() {
    this.title("服务器设置", 160);
    this.panel(60, 230, 600, 720);

    this.ctx.save();
    this.ctx.fillStyle = COLORS.muted;
    this.ctx.font = "500 20px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("填你的电脑局域网 IP（例如 192.168.1.8）", LOGICAL_W / 2, 255);
    this.ctx.restore();

    // input box
    this.ctx.save();
    roundRect(this.ctx, 140, 290, 440, 68, 12);
    this.ctx.fillStyle = COLORS.panel2;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = this.serverHostInput.length ? COLORS.text : COLORS.muted;
    this.ctx.font = "600 28px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(this.serverHostInput.length ? this.serverHostInput : "127.0.0.1", LOGICAL_W / 2, 324);
    this.ctx.restore();

    // keypad: digits + dot + backspace + save
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫", "保存"];
    const startX = 140;
    const startY = 400;
    const gap = 14;
    const bw = 132;
    const bh = 82;

    for (let i = 0; i < 12; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = startX + col * (bw + gap);
      const y = startY + row * (bh + gap);
      const label = keys[i];
      const b = new Button(
        x,
        y,
        bw,
        bh,
        label,
        () => {
          if (label === "⌫") this.serverHostInput = this.serverHostInput.slice(0, -1);
          else if (label === ".") {
            if (this.serverHostInput.length < 15) this.serverHostInput += ".";
          } else {
            if (this.serverHostInput.length < 15) this.serverHostInput += label;
          }
        },
        true
      );
      this.buttons.push(b);
      b.draw(this.ctx);
    }

    const saveEnabled = /^\d{1,3}(\.\d{1,3}){3}$/.test(this.serverHostInput) || this.serverHostInput === "127.0.0.1";
    const save = new Button(
      140,
      760,
      440,
      82,
      `保存（${this.serverUrl()}）`,
      () => {
        if (!saveEnabled) {
          wx.showToast?.({ title: "IP 格式不正确", icon: "none" });
          return;
        }
        this.serverHost = this.serverHostInput || "127.0.0.1";
        wx.setStorageSync?.("serverHost", this.serverHost);
        // reset socket
        this.ws?.close();
        this.ws = null;
        this.netError = null;
        this.connecting = false;
        this.screen = "menu";
      },
      saveEnabled
    );
    this.buttons.push(save);
    save.draw(this.ctx);

    const cancel = new Button(140, 860, 210, 72, "取消", () => (this.screen = "menu"));
    this.buttons.push(cancel);
    cancel.draw(this.ctx);
  }

  private renderRoom() {
    if (!this.room) {
      this.screen = "menu";
      return;
    }
    const room = this.room;

    this.title(`房间号：${room.code}`, 120);

    // left player list
    this.panel(40, 220, 260, 720);
    this.ctx.save();
    this.ctx.fillStyle = COLORS.muted;
    this.ctx.font = "600 22px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("玩家列表", 170, 260);
    this.ctx.restore();

    for (let i = 0; i < 4; i++) {
      const y = 310 + i * 150;
      this.drawPlayerSlot(60, y, i);
    }

    // character select (3 visible)
    this.panel(330, 220, 350, 560);
    this.ctx.save();
    this.ctx.fillStyle = COLORS.muted;
    this.ctx.font = "600 22px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("选择角色", 505, 260);
    this.ctx.restore();

    const left = new Button(355, 480, 64, 64, "<", () => {
      room.characterIndex = (room.characterIndex + 4) % 5;
      this.ws?.send({ type: "setCharacter", characterIndex: room.characterIndex });
    });
    const right = new Button(591, 480, 64, 64, ">", () => {
      room.characterIndex = (room.characterIndex + 1) % 5;
      this.ws?.send({ type: "setCharacter", characterIndex: room.characterIndex });
    });
    this.buttons.push(left, right);
    left.draw(this.ctx);
    right.draw(this.ctx);

    // center card
    const cardX = 435;
    const cardY = 360;
    this.ctx.save();
    roundRect(this.ctx, cardX, cardY, 140, 140, 16);
    this.ctx.fillStyle = "rgba(255,255,255,0.08)";
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.14)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = "700 26px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(`角色 ${room.characterIndex + 1}`, cardX + 70, cardY + 70);
    this.ctx.restore();

    const isHost = this.clientId != null && room.hostId === this.clientId;
    const label = isHost ? "开始游戏" : room.meReady ? "取消准备" : "准备";
    const enabled = isHost ? this.allGuestsReady() : true;
    const action = new Button(
      330,
      820,
      350,
      82,
      label,
      () => {
        if (isHost) {
          if (!this.allGuestsReady()) return;
          this.ws?.send({ type: "start" });
        } else {
          room.meReady = !room.meReady;
          const me = room.players.find((p) => p?.isLocal);
          if (me) me.ready = room.meReady;
          this.ws?.send({ type: "setReady", ready: room.meReady });
        }
      },
      enabled
    );
    this.buttons.push(action);
    action.draw(this.ctx);

    const back = new Button(40, 40, 160, 64, "返回", () => {
      this.ws?.send({ type: "leave" });
      this.ws?.close();
      this.ws = null;
      this.room = null;
      this.clientId = null;
      this.screen = "menu";
    });
    this.buttons.push(back);
    back.draw(this.ctx);
  }

  private drawPlayerSlot(x: number, y: number, idx: number) {
    if (!this.room) return;
    const slot = this.room.players[idx];
    this.ctx.save();
    roundRect(this.ctx, x, y, 220, 120, 14);
    this.ctx.fillStyle = "rgba(15,26,49,0.9)";
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.10)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    if (!slot) {
      // plus icon
      this.ctx.fillStyle = "rgba(255,255,255,0.18)";
      this.ctx.beginPath();
      this.ctx.arc(x + 46, y + 60, 22, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = "700 28px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("+", x + 46, y + 60);

      this.ctx.fillStyle = COLORS.muted;
      this.ctx.font = "600 22px Arial";
      this.ctx.textAlign = "left";
      this.ctx.fillText("--", x + 82, y + 52);

      // clickable area on avatar
      const b = new Button(x + 24, y + 38, 44, 44, "", () => this.shareInvite());
      b.enabled = true;
      this.buttons.push(b);
      return;
    }

    // avatar placeholder
    this.ctx.fillStyle = slot.isLocal ? "rgba(74,163,255,0.35)" : "rgba(255,255,255,0.10)";
    this.ctx.beginPath();
    this.ctx.arc(x + 46, y + 60, 22, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = "700 22px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(slot.name, x + 82, y + 52);

    this.ctx.fillStyle = slot.ready ? COLORS.ok : COLORS.danger;
    this.ctx.font = "600 20px Arial";
    this.ctx.fillText(slot.ready ? "已准备" : "未准备", x + 82, y + 82);
    this.ctx.restore();
  }

  private renderInGame() {
    this.title("局内占位", 160);
    this.ctx.save();
    this.ctx.fillStyle = COLORS.muted;
    this.ctx.font = "500 24px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("下一步接入联机与玩法系统", LOGICAL_W / 2, 220);
    this.ctx.restore();

    const back = new Button(180, 560, 360, 82, "结束（回房间）", () => (this.screen = "room"));
    this.buttons.push(back);
    back.draw(this.ctx);
  }

  private connectAndCreate() {
    this.netError = null;
    this.connecting = true;
    this.ensureWs();
    this.ws?.connect();
    // actual create happens on open (or if already open)
    this.ws?.send({ type: "create", name: "你" });
  }

  private connectAndJoin(code: string) {
    if (!/^\d{6}$/.test(code)) return;
    this.netError = null;
    this.connecting = true;
    this.ensureWs();
    this.ws?.connect();
    this.ws?.send({ type: "join", roomCode: code, name: "你" });
  }

  private ensureWs() {
    if (this.ws) return;
    // Lazy import to avoid circular TS issues
    const { WsClient } = require("./net/wsClient") as typeof import("./net/wsClient");
    this.ws = new WsClient(this.serverUrl(), {
      onOpen: () => {
        this.connecting = false;
      },
      onClose: () => {
        this.connecting = false;
      },
      onError: (err: any) => {
        this.connecting = false;
        this.netError = err?.errMsg ? String(err.errMsg) : "连接失败";
      },
      onMessage: (msg: any) => this.onServerMessage(msg)
    });
  }

  private onServerMessage(msg: any) {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "welcome") {
      this.clientId = String(msg.clientId || "");
      return;
    }
    if (msg.type === "error") {
      this.netError = String(msg.message || "错误");
      wx.showToast?.({ title: this.netError, icon: "none" });
      return;
    }
    if (msg.type === "roomState" && msg.room) {
      const r = msg.room;
      const players: (PlayerRow | null)[] = (r.players || []).slice(0, 4).map((p: any) => {
        if (!p) return null;
        const id = String(p.id || "");
        return {
          name: String(p.name || "玩家"),
          ready: !!p.ready,
          isLocal: this.clientId != null && id === this.clientId
        };
      });
      const me = players.find((p) => p?.isLocal);
      this.room = {
        code: String(r.code || ""),
        hostId: String(r.hostId || ""),
        meReady: !!me?.ready,
        players,
        characterIndex: clamp(this.room?.characterIndex ?? 0, 0, 4)
      };
      this.screen = "room";
      this.connecting = false;

      if (String(r.phase) === "ingame") {
        this.screen = "ingame";
      }
    }
  }

  private allGuestsReady() {
    if (!this.room) return false;
    // host fixed ready; check all non-null others.
    return this.room.players.every((p) => !p || p.isLocal || p.ready);
  }

  private shareInvite() {
    if (!this.room) return;
    try {
      wx.shareAppMessage?.({
        title: `来联机！房间号：${this.room.code}`,
        query: `roomCode=${this.room.code}`
      });
    } catch {
      // fallback
      wx.showToast?.({ title: "分享不可用（开发工具模拟器限制）", icon: "none" });
    }
  }
}

// Boot
new App();

