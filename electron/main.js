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
    .slice(0, 120) || "Song";
}

async function translateLyricsLines(lines, targetLanguage) {
  const source = lines.map((line) => String(line || ""));
  const translate = async (text) => {
    if (!text.trim()) return "";
    const params = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: targetLanguage,
      dt: "t",
      q: text,
    });
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error("Translation service did not respond.");
    const data = await response.json();
    return Array.isArray(data?.[0])
      ? data[0].map((part) => part?.[0] || "").join("")
      : text;
  };
  const translated = [];
  for (let index = 0; index < source.length; index += 6) {
    const group = source.slice(index, index + 6);
    translated.push(...(await Promise.all(group.map(translate))));
  }
  return translated;
}

const AI_DEFAULTS = {
  provider: "builtin",
  model: "",
  baseUrl: "",
};

function aiConfigPath() {
  return path.join(app.getPath("userData"), "ai-translation.json");
}

function readAITranslationConfig() {
  try {
    const stored = JSON.parse(fs.readFileSync(aiConfigPath(), "utf8"));
    let apiKey = "";
    if (stored.encryptedKey && safeStorage.isEncryptionAvailable()) {
      apiKey = safeStorage.decryptString(
        Buffer.from(stored.encryptedKey, "base64"),
      );
    }
    return { ...AI_DEFAULTS, ...stored, apiKey };
  } catch {
    return { ...AI_DEFAULTS, apiKey: "" };
  }
}

function writeAITranslationConfig(config = {}) {
  const previous = readAITranslationConfig();
  const next = {
    provider: config.provider || previous.provider || "builtin",
    model: String(config.model ?? previous.model ?? "").trim(),
    baseUrl: String(config.baseUrl ?? previous.baseUrl ?? "").trim(),
  };
  let apiKey = config.clearKey ? "" : String(config.apiKey || previous.apiKey || "");
