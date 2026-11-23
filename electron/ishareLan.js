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
