import { Room, Client } from "colyseus";
import { RoomState, PlayerState } from "../state.js";

type ClientMeta = {
  name?: string;
};

type MsgSetReady = { ready: boolean };
type MsgSetCharacter = { characterId: string };

export class SurvivorRoom extends Room<{ state: RoomState }> {
  maxClients = 4;

  onCreate() {
    this.setState(new RoomState());
    this.state.maxPlayers = this.maxClients;
    this.state.roomCode = this.generateRoomCode();

    this.onMessage("setReady", (client, msg: MsgSetReady) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.ready = !!msg?.ready;
    });

    this.onMessage("setCharacter", (client, msg: MsgSetCharacter) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.characterId !== "string") return;
      p.characterId = msg.characterId;
    });

    this.onMessage("start", (client) => {
      if (client.sessionId !== this.state.hostId) return;
      if (this.state.phase !== "lobby") return;
      if (!this.allNonHostReady()) return;
      this.state.phase = "ingame";
      // v0: only switch phase; gameplay state comes next.
    });
  }

  onJoin(client: Client, options: ClientMeta) {
    const p = new PlayerState();
    p.id = client.sessionId;
    p.name = (options?.name && String(options.name).slice(0, 16)) || "玩家";
    p.ready = false;
    p.connected = true;
    this.state.players.set(client.sessionId, p);

    if (!this.state.hostId) {
      this.state.hostId = client.sessionId;
      p.ready = true; // host fixed ready
    }
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) {
      p.connected = false;
    }
    // v0: remove immediately
    this.state.players.delete(client.sessionId);

    if (client.sessionId === this.state.hostId) {
      const next = this.state.players.keys().next().value as string | undefined;
      this.state.hostId = next ?? "";
      if (next) {
        const host = this.state.players.get(next);
        if (host) host.ready = true;
      }
    }

    if (this.state.players.size === 0) {
      this.disconnect();
    }
  }

  private allNonHostReady() {
    for (const [id, p] of this.state.players.entries()) {
      if (id === this.state.hostId) continue;
      if (!p.ready) return false;
    }
    return true;
  }

  private generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

