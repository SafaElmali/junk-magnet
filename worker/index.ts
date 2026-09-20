import { DurableObject } from "cloudflare:workers";
import { createCoopHub, type CoopSocket } from "../server/hub";

interface Env {
  COOP: DurableObjectNamespace<JunkMagnetCoop>;
  ALLOWED_ORIGINS: string;
}

/** Cloudflare handles protocol ping/pong and closes lost connections itself. */
class CloudflareSocket implements CoopSocket {
  constructor(private socket: WebSocket) {}
  get readyState() {
    return this.socket.readyState;
  }
  get bufferedAmount() {
    return 0;
  }
  send(data: string) {
    this.socket.send(data);
  }
  close(code = 1000, reason = "") {
    this.socket.close(code, reason);
  }
  terminate() {
    this.close(1001, "Connection closed");
  }
  private pong?: () => void;
  ping() {
    this.pong?.();
  }
  on(event: "message", listener: (raw: { toString(): string }) => void): void;
  on(event: "pong" | "error" | "close", listener: () => void): void;
  on(
    event: "message" | "pong" | "error" | "close",
    listener: (raw: { toString(): string }) => void,
  ) {
    if (event === "pong") {
      this.pong = listener as () => void;
    } else if (event === "message") {
      this.socket.addEventListener("message", (message) => {
        if (
          typeof message.data !== "string" ||
          new TextEncoder().encode(message.data).length > 2048
        ) {
          this.close(1009, "Message too large");
          return;
        }
        listener(message.data);
      });
    } else {
      this.socket.addEventListener(event, listener as () => void);
    }
  }
}

export class JunkMagnetCoop extends DurableObject<Env> {
  private hub = createCoopHub();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    if (this.hub.connections >= 32) {
      return new Response("Server full", { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // The 30 Hz simulation must stay in memory while players are connected.
    // Closing the last connection stops the hub timers so the object can idle.
    server.accept();
    this.hub.connect(new CloudflareSocket(server));
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health") return Response.json({ ok: true });
    if (path !== "/coop") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    const origin = request.headers.get("Origin");
    if (!origin || !env.ALLOWED_ORIGINS.split(",").includes(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    // One bounded room directory preserves six-character invitations across clients.
    return env.COOP.getByName("rooms-v1").fetch(request);
  },
} satisfies ExportedHandler<Env>;
