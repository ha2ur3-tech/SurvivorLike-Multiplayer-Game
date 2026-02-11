import { MapSchema, Schema, type } from "@colyseus/schema";

export type Phase = "lobby" | "ingame" | "result";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") characterId: string = "char_0";
  @type("boolean") ready: boolean = false;
  @type("boolean") connected: boolean = true;
}

export class RoomState extends Schema {
  @type("string") roomCode: string = "";
  @type("string") hostId: string = "";
  @type("string") phase: Phase = "lobby";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("number") maxPlayers: number = 4;
}

