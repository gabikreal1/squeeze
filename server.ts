import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { runMigrations } from "./lib/db/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  runMigrations();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: "/ws/conversation-relay" });

  wss.on("connection", (ws) => {
    console.log("[conversation-relay] client connected");

    // Conversation Relay placeholder:
    // - Accept Twilio media stream events (setup, start, media, stop)
    // - Pipe audio to STT / OpenAI Realtime for debtor dialogue
    // - Stream TTS responses back to the call leg
    // - Emit structured outcomes (promise, dispute, hang-up) to the orchestrator

    ws.on("message", (data) => {
      console.log("[conversation-relay] message received", data.toString().slice(0, 120));
    });

    ws.on("close", () => {
      console.log("[conversation-relay] client disconnected");
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
