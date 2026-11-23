const http = require("http");
const dgram = require("dgram");
const os = require("os");
const crypto = require("crypto");

let lanHost = null;

function localIpv4() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

function normalizeAddress(raw, defaultPort = 8765) {
  const value = String(raw || "").trim();
  if (/^(airbeats|ishare):\/\/together/i.test(value)) {
    const parsed = new URL(value);
    const host = parsed.searchParams.get("host");
    const port = parsed.searchParams.get("port") || defaultPort;
    if (host) return `${host}:${port}`;
  }
  const clean = value
    .replace(/^(https?|wss?):\/\//i, "")
    .split("/")[0];
  return clean.includes(":") ? clean : `${clean}:${defaultPort}`;
}

function participant(id, name, isHost = false) {
  return { id, name: name || "iShare Listener", isHost };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("LAN request is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        resolve({});
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Connection: "close",
  });
  response.end(payload);
}

class IShareLanHost {
  constructor({ displayName, state, settings, port = 8765 }) {
    this.displayName = displayName || "iTune Desktop";
    this.state = state || null;
    this.settings = {
      allowGuestsToControlPlayback: false,
      allowGuestsToAddTracks: true,
      ...(settings || {}),
    };
    this.port = Number(port) || 8765;
    this.ip = localIpv4();
    this.sessionId = crypto.randomBytes(4).toString("hex").toUpperCase();
    this.stateVersion = 1;
    this.participants = new Map([
      ["host", participant("host", this.displayName, true)],
    ]);
    this.pendingActions = [];
    this.server = null;
    this.discovery = null;
  }

  snapshot(participantId = "host") {
    const queue = this.state?.queue || [];
    return {
      code: `${this.ip}:${this.port}`,
      participantId,
      joinUrl: `airbeats://together?host=${this.ip}&port=${this.port}&sid=${this.sessionId}`,
      participants: this.participants.size,
      participantList: [...this.participants.values()].sort(
        (a, b) => Number(b.isHost) - Number(a.isHost),
      ),
      hostName: this.displayName,
      controllerId: "host",
      controllerName: this.displayName,
      stateVersion: this.stateVersion,
      serverNow: Date.now(),
      state: this.state ? { ...this.state, settings: this.settings, queue } : null,
      settings: this.settings,
      queue,
    };
  }

  async route(request, response) {
    if (request.method === "OPTIONS") {
      sendJson(response, 200, {});
      return;
    }
    const url = new URL(request.url, `http://${this.ip}:${this.port}`);
    const pathname = url.pathname;
    if (pathname === "/together/status" || pathname === "/together/ping") {
      sendJson(response, 200, {
        status: "ok",
        app: "AirBeats",
        client: "iShare",
        sessionId: this.sessionId,
        hostName: this.displayName,
        participants: this.participants.size,
      });
      return;
    }
    if (pathname === "/together/join" && request.method === "POST") {
      const body = await readBody(request);
      const id = crypto.randomBytes(4).toString("hex");
      this.participants.set(id, participant(id, body.name));
      this.stateVersion++;
      sendJson(response, 200, this.snapshot(id));
      return;
    }
    if (pathname === "/together/state" && request.method === "GET") {
      sendJson(
        response,
        200,
        this.snapshot(url.searchParams.get("participantId") || "guest"),
      );
      return;
    }
    if (pathname === "/together/queue" && request.method === "GET") {
      sendJson(response, 200, { queue: this.state?.queue || [] });
      return;
    }
    if (pathname === "/together/state" && request.method === "POST") {
      const body = await readBody(request);
      const sender = body.participantId || "guest";
      const isHost = sender === "host";
      if (!isHost && !this.settings.allowGuestsToControlPlayback) {
        sendJson(response, 403, { error: "Playback controls are disabled by the host" });
        return;
      }
      if (body.state) {
        this.state = { ...body.state, settings: this.settings };
        this.stateVersion++;
      }
      sendJson(response, 200, this.snapshot(sender));
      return;
    }
    if (pathname === "/together/action" && request.method === "POST") {
      const body = await readBody(request);
      const sender = body.participantId || "guest";
      const controlActions = new Set([
        "play",
        "resume",
        "pause",
        "toggle_play_pause",
        "seek",
        "next",
        "previous",
      ]);
      const queueActions = new Set(["add_to_queue", "play_next", "remove_from_queue"]);
      if (
        sender !== "host" &&
        controlActions.has(body.action) &&
        !this.settings.allowGuestsToControlPlayback
      ) {
        sendJson(response, 403, { error: "Playback controls are disabled by the host" });
        return;
      }
      if (
        sender !== "host" &&
        queueActions.has(body.action) &&
        !this.settings.allowGuestsToAddTracks &&
        !this.settings.allowGuestsToControlPlayback
      ) {
        sendJson(response, 403, { error: "Queue modification is disabled by the host" });
        return;
      }
      if (body.action) {
        this.pendingActions.push({
          action: body.action,
          positionMs: body.positionMs,
          extraData: body.extraData || null,
          participantId: sender,
        });
        this.stateVersion++;
      }
      sendJson(response, 200, this.snapshot(sender));
      return;
    }
    if (pathname === "/together/settings" && request.method === "POST") {
      const body = await readBody(request);
      if ((body.participantId || "guest") === "host") {
        this.settings = {
          allowGuestsToControlPlayback: Boolean(body.allowGuestsToControlPlayback),
          allowGuestsToAddTracks: body.allowGuestsToAddTracks !== false,
        };
        this.stateVersion++;
      }
      sendJson(response, 200, this.snapshot(body.participantId));
      return;
    }
    if (pathname === "/together/leave" && request.method === "POST") {
      const body = await readBody(request);
      if (body.participantId && body.participantId !== "host") {
        this.participants.delete(body.participantId);
        this.stateVersion++;
      }
      sendJson(response, 200, { status: "ok" });
      return;
    }
    sendJson(response, 404, { error: "Not Found" });
  }

  start() {
    if (!this.ip) throw new Error("Connect this PC to Wi-Fi or Ethernet first.");
    return new Promise((resolve, reject) => {
      this.server = http.createServer((request, response) => {
        this.route(request, response).catch((error) =>
          sendJson(response, 500, { error: error.message }),
        );
      });
      this.server.once("error", reject);
      this.server.listen(this.port, "0.0.0.0", () => {
        this.server.removeListener("error", reject);
        this.discovery = dgram.createSocket({ type: "udp4", reuseAddr: true });
        this.discovery.on("message", (message, remote) => {
          const text = message.toString("utf8").trim();
          if (!text.startsWith("AIRBEATS_DISCOVER") && !text.startsWith("ISHARE_DISCOVER")) return;
          const reply = Buffer.from(
            `AIRBEATS_HOST:${this.port}:${this.displayName}:${this.sessionId}:${this.participants.size}`,
          );
          this.discovery.send(reply, remote.port, remote.address);
        });
        this.discovery.bind(this.port, "0.0.0.0", () => {
          this.discovery.setBroadcast(true);
        });
        resolve(this.snapshot("host"));
