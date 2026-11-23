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
