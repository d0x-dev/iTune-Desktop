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
