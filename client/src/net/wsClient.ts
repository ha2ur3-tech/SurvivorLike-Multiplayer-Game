/* eslint-disable @typescript-eslint/no-explicit-any */
declare const wx: any;

export type ServerMsg =
  | { type: "welcome"; clientId: string }
  | { type: "error"; code: string; message: string }
  | { type: "roomState"; room: RoomSnapshot };

export type PlayerSnapshot = {
  id: string;
  name: string;
  ready: boolean;
  characterIndex: number;
};

export type RoomSnapshot = {
  code: string;
  hostId: string;
  phase: "lobby" | "ingame" | "result";
  maxPlayers: number;
  players: (PlayerSnapshot | null)[];
};

export type ClientMsg =
  | { type: "create"; name?: string }
  | { type: "join"; roomCode: string; name?: string }
  | { type: "leave" }
  | { type: "setReady"; ready: boolean }
  | { type: "setCharacter"; characterIndex: number }
  | { type: "start" }
  | { type: "ping"; t?: number };

export type WsClientEvents = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: any) => void;
  onMessage?: (msg: ServerMsg) => void;
};

export class WsClient {
  private task: any | null = null;
  private url: string;
  private opened = false;
  private pending: ClientMsg[] = [];

  constructor(url: string, private events: WsClientEvents = {}) {
    this.url = url;
  }

  connect() {
    if (this.task) return;
    this.opened = false;
    this.pending = [];

    const task = wx.connectSocket({ url: this.url });
    this.task = task;

    task.onOpen(() => {
      this.opened = true;
      this.events.onOpen?.();
      // flush pending
      for (const m of this.pending) this.send(m);
      this.pending = [];
    });
    task.onClose(() => {
      this.task = null;
      this.opened = false;
      this.events.onClose?.();
    });
    task.onError((err: any) => {
      this.events.onError?.(err);
    });
    task.onMessage((e: any) => {
      try {
        const data = typeof e.data === "string" ? e.data : String(e.data);
        const msg = JSON.parse(data) as ServerMsg;
        this.events.onMessage?.(msg);
      } catch {
        // ignore malformed
      }
    });
  }

  close() {
    try {
      this.task?.close?.();
    } catch {}
    this.task = null;
    this.opened = false;
  }

  send(msg: ClientMsg) {
    if (!this.task || !this.opened) {
      // queue until open
      this.pending.push(msg);
      return;
    }
    try {
      this.task.send({ data: JSON.stringify(msg) });
    } catch {}
  }
}

