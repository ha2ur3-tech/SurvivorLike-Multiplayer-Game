import type http from "http";
import { WebSocketServer, type WebSocket } from "ws";

type Phase = "lobby" | "ingame" | "result";

type Player = {
  id: string;
  name: string;
  ready: boolean;
  characterIndex: number;
  ws: WebSocket;
};

type Room = {
  code: string;
  hostId: string;
  phase: Phase;
  maxPlayers: number;
  players: Map<string, Player>;
};

type ClientSession = {
  id: string;
  ws: WebSocket;
  roomCode?: string;
};

type Msg =
  | { type: "create"; name?: string }
  | { type: "join"; roomCode: string; name?: string }
  | { type: "leave" }
  | { type: "setReady"; ready: boolean }
  | { type: "setCharacter"; characterIndex: number }
  | { type: "start" }
  | { type: "ping"; t?: number };

type ServerMsg =
  | { type: "welcome"; clientId: string }
  | { type: "error"; code: string; message: string }
  | { type: "roomState"; room: RoomSnapshot };

type PlayerSnapshot = {
  id: string;
  name: string;
  ready: boolean;
  characterIndex: number;
};

type RoomSnapshot = {
  code: string;
  hostId: string;
  phase: Phase;
  maxPlayers: number;
  players: (PlayerSnapshot | null)[];
};

function safeParse(data: WebSocket.RawData): Msg | null {
  try {
    const s = typeof data === "string" ? data : data.toString("utf8");
    return JSON.parse(s) as Msg;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMsg) {
  for (const p of room.players.values()) send(p.ws, msg);
}

function makeCode(existing: Set<string>) {
  for (let i = 0; i < 20; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    if (!existing.has(code)) return code;
  }
  // extremely unlikely fallback
  return `${Date.now()}`.slice(-6);
}

function snapshot(room: Room): RoomSnapshot {
  const arr: (PlayerSnapshot | null)[] = Array.from({ length: room.maxPlayers }, () => null);
  let idx = 0;
  for (const p of room.players.values()) {
    if (idx >= arr.length) break;
    arr[idx++] = { id: p.id, name: p.name, ready: p.ready, characterIndex: p.characterIndex };
  }
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    maxPlayers: room.maxPlayers,
    players: arr
  };
}

export function attachWsLobby(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const rooms = new Map<string, Room>();
  const clientRoom = new Map<string, string>(); // clientId -> roomCode

  const ensureHostReady = (room: Room) => {
    const host = room.players.get(room.hostId);
    if (host) host.ready = true;
  };

  const removeFromRoom = (clientId: string) => {
    const roomCode = clientRoom.get(clientId);
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    clientRoom.delete(clientId);
    if (!room) return;
    room.players.delete(clientId);

    if (room.players.size === 0) {
      rooms.delete(roomCode);
      return;
    }

    if (room.hostId === clientId) {
      const next = room.players.keys().next().value as string | undefined;
      if (next) {
        room.hostId = next;
        ensureHostReady(room);
      }
    }

    broadcast(room, { type: "roomState", room: snapshot(room) });
  };

  const joinRoom = (session: ClientSession, room: Room, name: string) => {
    if (room.players.size >= room.maxPlayers) {
      send(session.ws, { type: "error", code: "ROOM_FULL", message: "房间已满" });
      return;
    }
    if (room.phase !== "lobby") {
      send(session.ws, { type: "error", code: "ROOM_STARTED", message: "房间已开始游戏" });
      return;
    }

    const p: Player = {
      id: session.id,
      name: name.slice(0, 16) || "玩家",
      ready: false,
      characterIndex: 0,
      ws: session.ws
    };
    room.players.set(session.id, p);
    clientRoom.set(session.id, room.code);

    if (!room.hostId) {
      room.hostId = session.id;
      ensureHostReady(room);
    }

    broadcast(room, { type: "roomState", room: snapshot(room) });
  };

  wss.on("connection", (ws) => {
    const session: ClientSession = { id: crypto.randomUUID(), ws };
    send(ws, { type: "welcome", clientId: session.id });

    ws.on("message", (data) => {
      const msg = safeParse(data);
      if (!msg) {
        send(ws, { type: "error", code: "BAD_JSON", message: "消息格式错误" });
        return;
      }

      switch (msg.type) {
        case "ping": {
          // no-op v0
          return;
        }
        case "leave": {
          removeFromRoom(session.id);
          return;
        }
        case "create": {
          removeFromRoom(session.id);
          const code = makeCode(new Set(rooms.keys()));
          const room: Room = {
            code,
            hostId: session.id,
            phase: "lobby",
            maxPlayers: 4,
            players: new Map()
          };
          rooms.set(code, room);
          joinRoom(session, room, msg.name || "你");
          // host fixed ready
          const me = room.players.get(session.id);
          if (me) me.ready = true;
          broadcast(room, { type: "roomState", room: snapshot(room) });
          return;
        }
        case "join": {
          removeFromRoom(session.id);
          const code = String(msg.roomCode || "");
          if (!/^\d{6}$/.test(code)) {
            send(ws, { type: "error", code: "BAD_CODE", message: "房间号必须为 6 位数字" });
            return;
          }
          const room = rooms.get(code);
          if (!room) {
            send(ws, { type: "error", code: "NOT_FOUND", message: "房间不存在" });
            return;
          }
          joinRoom(session, room, msg.name || "你");
          return;
        }
        case "setReady": {
          const roomCode = clientRoom.get(session.id);
          if (!roomCode) return;
          const room = rooms.get(roomCode);
          if (!room) return;
          const p = room.players.get(session.id);
          if (!p) return;
          if (session.id === room.hostId) {
            // host fixed ready
            p.ready = true;
          } else {
            p.ready = !!msg.ready;
          }
          broadcast(room, { type: "roomState", room: snapshot(room) });
          return;
        }
        case "setCharacter": {
          const roomCode = clientRoom.get(session.id);
          if (!roomCode) return;
          const room = rooms.get(roomCode);
          if (!room) return;
          const p = room.players.get(session.id);
          if (!p) return;
          p.characterIndex = Math.max(0, Math.min(4, Math.floor(msg.characterIndex)));
          broadcast(room, { type: "roomState", room: snapshot(room) });
          return;
        }
        case "start": {
          const roomCode = clientRoom.get(session.id);
          if (!roomCode) return;
          const room = rooms.get(roomCode);
          if (!room) return;
          if (session.id !== room.hostId) return;
          if (room.phase !== "lobby") return;
          // all non-host ready
          for (const p of room.players.values()) {
            if (p.id === room.hostId) continue;
            if (!p.ready) {
              send(ws, { type: "error", code: "NOT_READY", message: "有玩家未准备" });
              return;
            }
          }
          room.phase = "ingame";
          broadcast(room, { type: "roomState", room: snapshot(room) });
          return;
        }
      }
    });

    ws.on("close", () => {
      removeFromRoom(session.id);
    });
  });

  return { wss };
}

