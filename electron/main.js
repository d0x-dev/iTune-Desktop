const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  safeStorage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const vm = require("vm");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const githubUpdates = require("./githubUpdates");
let highQualityArtwork = (url) => url;
const { parseHomePage, parseRadioTracks } = require("./homeFeed");
const homeRequests = new WeakMap();
const appleArtwork = require("./appleArtwork");
const ishare = require("./ishare");
const ishareLan = require("./ishareLan");
const {
  AUTO_ORDER,
  fetchLyricsProvider,
} = require("./lyricsSources");
let innertubeModule = null;
async function getInnertube() {
  if (!innertubeModule) {
    innertubeModule = await import("youtubei.js");
  }
  return innertubeModule;
}

const APP_USER_MODEL_ID = "com.darkxvenom.itune.desktop";
app.setName("itune-desktop");
if (process.platform === "win32")
  app.setAppUserModelId?.(APP_USER_MODEL_ID);
app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");

let mainWindow = null;
let authWindow = null;
let yt = null;
let initPromise = null;
let loginResolver = null;
let lyricsFullscreenRestore = null;
const playbackReports = new Map();
const RADIO_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
];
let activeRadioMirror = RADIO_MIRRORS[0];

let userProfile = {
  name: null,
  email: null,
  photo: null,
  isLoggedIn: false,
};

// Logger to file for troubleshooting
function logToFile(...args) {
  const msg = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")}\n`;
  console.log(...args);
  try {
    const logPath = path.join(
      app.getPath("userData"),
      "app.log",
    );
    fs.appendFileSync(logPath, msg);
  } catch (e) {}
}

async function fetchRadioJson(pathname) {
  for (const base of [activeRadioMirror, ...RADIO_MIRRORS]) {
    try {
      const response = await fetch(`${base}${pathname}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "iTune Desktop/1.0.0",
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) continue;
      activeRadioMirror = base;
      return await response.json();
    } catch {}
  }
  throw new Error("Online radio is unavailable right now.");
}

function normalizeRadioStation(station) {
  const streamUrl = String(
    station?.url_resolved || station?.url || "",
  ).trim();
  if (!station?.stationuuid || !station?.name || !/^https?:\/\//i.test(streamUrl))
    return null;
  return {
    id: `radio:${station.stationuuid}`,
    uuid: station.stationuuid,
    title: String(station.name).trim(),
    streamUrl,
    fallbackUrl:
      station.url && station.url !== streamUrl ? String(station.url) : "",
    thumbnail: /^https?:\/\//i.test(station.favicon || "")
      ? station.favicon
      : null,
    homepage: station.homepage || "",
    countryCode: station.countrycode || "",
    countryName: station.country || "",
    cityState: station.state || "",
    language: station.language || "",
    tags: String(station.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    codec: String(station.codec || "STREAM").toUpperCase(),
    bitrateKbps: Math.max(0, Number(station.bitrate) || 0),
    votes: Math.max(0, Number(station.votes) || 0),
    isHls: Number(station.hls) === 1,
    type: "radio",
    artists: [{ name: station.country || station.language || "Online Radio" }],
  };
}

function safeDownloadName(value) {
  return String(value || "Song")
    .replace(/[<>:\"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
