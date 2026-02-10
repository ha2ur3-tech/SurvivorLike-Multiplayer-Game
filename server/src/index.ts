import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { SurvivorRoom } from "./rooms/SurvivorRoom.js";

const PORT = Number(process.env.PORT || 2567);

const app = express();
app.get("/health", (_req, res) => res.status(200).send("ok"));

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("survivor", SurvivorRoom);
app.use("/colyseus", monitor());

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Survivor server listening on :${PORT}`);
});

