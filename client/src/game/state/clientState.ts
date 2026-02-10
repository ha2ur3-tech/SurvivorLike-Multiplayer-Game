export type PlayerId = string;

export type PlayerInfo = {
  id: PlayerId;
  name: string;
  avatarUrl?: string;
  isLocal: boolean;
  isReady: boolean;
  characterId: string;
};

export type RoomSnapshot = {
  roomCode: string;
  hostId: PlayerId;
  players: PlayerInfo[]; // includes empty slots? v0 we keep only actual players.
  maxPlayers: number;
  phase: "lobby" | "ingame" | "result";
};

class ClientState {
  room?: RoomSnapshot;
  localPlayerId: PlayerId = "local";
  localName: string = "你";
}

export const clientState = new ClientState();

