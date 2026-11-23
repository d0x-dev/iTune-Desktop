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
  if (apiKey) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("System secure key storage is unavailable.");
    next.encryptedKey = safeStorage.encryptString(apiKey).toString("base64");
  }
  fs.mkdirSync(path.dirname(aiConfigPath()), { recursive: true });
  fs.writeFileSync(aiConfigPath(), JSON.stringify(next, null, 2), "utf8");
  return { ...next, hasKey: Boolean(apiKey) };
}

function aiProviderDefaults(provider) {
  if (provider === "openrouter")
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "openai/gpt-4o-mini",
    };
  if (provider === "gemini")
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-2.5-flash",
    };
  if (provider === "claude")
    return {
      url: "https://api.anthropic.com/v1/messages",
      model: "claude-haiku-4-5-20251001",
    };
  return {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  };
}

function resolveAiEndpoint(provider, customUrl) {
  const defaults = aiProviderDefaults(provider);
  const raw = String(customUrl || defaults.url).replace(/\/$/, "");
  if (/\/(chat\/completions|messages)$/.test(raw)) return raw;
  if (provider === "claude") return `${raw}/messages`;
  return `${raw}/chat/completions`;
}

function parseAiTranslation(text, expectedCount) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("The AI returned an unreadable answer.");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed) || parsed.length !== expectedCount)
    throw new Error(`The AI returned ${parsed?.length || 0} lines instead of ${expectedCount}.`);
  return parsed.map((line) => String(line ?? ""));
}

async function translateLyricsWithAI(lines, targetLanguage, mode, config) {
  if (!config.apiKey) throw new Error("Add an API key in Settings → AI Lyrics Translation.");
  const provider = config.provider;
  const defaults = aiProviderDefaults(provider);
  const model = config.model || defaults.model;
  const endpoint = resolveAiEndpoint(provider, config.baseUrl || defaults.url);
  const lineCount = lines.length;
  const modeInstruction =
    mode === "hinglish"
      ? "Translate into natural Hinglish using only the English/Latin alphabet. Never use Devanagari."
      : mode === "romanized"
        ? "Romanize/transliterate into plain Latin alphabet characters."
        : "Translate naturally while preserving poetic meaning, rhythm, and emotion.";
  const prompt = `${modeInstruction}\nTarget language code: ${targetLanguage}.\nReturn ONLY a valid JSON array containing exactly ${lineCount} strings, one for each input line. Preserve empty lines.\n\nLyrics:\n${lines.join("\n")}`;
  const headers = { "Content-Type": "application/json" };
  let body;
  if (provider === "claude") {
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      max_tokens: Math.max(1024, lineCount * 70),
      messages: [{ role: "user", content: prompt }],
    };
  } else {
    headers.Authorization = `Bearer ${config.apiKey}`;
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/Darkxvenom/iTune";
      headers["X-Title"] = "iTune Desktop";
    }
    body = {
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert song-lyrics translator. Output JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: Math.max(1024, lineCount * 70),
    };
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result?.error?.message || result?.message || `AI request failed (${response.status}).`,
    );
  const content =
    provider === "claude"
      ? result?.content?.find((part) => part.type === "text")?.text
      : result?.choices?.[0]?.message?.content;
  return parseAiTranslation(content, lineCount);
}

function lrcTime(milliseconds) {
  const total = Math.max(0, Number(milliseconds) || 0) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(2).padStart(5, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

async function youtubeSubtitleLyrics(client, videoId) {
  try {
    const info = await client.getInfo(videoId);
    const transcriptInfo = await info.getTranscript();
    const segments = transcriptInfo?.transcript?.content?.body?.initial_segments;
    if (!Array.isArray(segments) || !segments.length) return null;
    const lines = segments
      .filter((segment) => segment?.snippet?.toString && segment.start_ms != null)
      .map(
        (segment) =>
          `[${lrcTime(segment.start_ms)}]${segment.snippet.toString().trim()}`,
      )
      .filter((line) => line.length > 12);
    return lines.length
      ? { lyrics: lines.join("\n"), source: "YouTube Subtitles", synced: true }
      : null;
  } catch {
    return null;
  }
}

// Sanitize and deduplicate cookie string (giving priority to YouTube cookies over Google cookies)
function sanitizeAndDeduplicateCookie(rawCookie) {
  if (!rawCookie || typeof rawCookie !== "string") return "";
  const pairs = rawCookie.split(";");
  const map = new Map();
  for (const p of pairs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k) map.set(k, v);
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// Check multiple locations for saved session cookies
function getSessionPaths() {
  const legacyWindowsPaths = process.env.APPDATA
    ? [
        path.join(process.env.APPDATA, "itune-desktop", "itune_session.json"),
        path.join(process.env.APPDATA, "iTune Desktop", "itune_session.json"),
      ]
    : [];
  return [...legacyWindowsPaths, path.join(app.getPath("userData"), "itune_session.json")];
}

function loadSavedCookie() {
  try {
    for (const sessionFile of getSessionPaths()) {
      if (fs.existsSync(sessionFile)) {
        const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
        if (data.cookie && data.cookie.trim()) {
          const cleaned = sanitizeAndDeduplicateCookie(data.cookie.trim());
          logToFile("Loaded and sanitized session cookie from:", sessionFile);
          return cleaned;
        }
      }
    }
  } catch (err) {
    logToFile("Failed to load saved session cookie:", err);
  }
  return "";
}

function saveCookie(cookieStr) {
  try {
    const cleaned = sanitizeAndDeduplicateCookie(cookieStr);
    const payload = JSON.stringify({ cookie: cleaned, savedAt: Date.now() });
    for (const sessionFile of getSessionPaths()) {
      try {
        fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
        fs.writeFileSync(sessionFile, payload, "utf-8");
        logToFile("Saved sanitized session cookie to:", sessionFile);
      } catch (e) {}
    }
  } catch (err) {
    logToFile("Failed to save session cookie:", err);
  }
}

function clearSavedCookie() {
  try {
    for (const sessionFile of getSessionPaths()) {
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }
    }
    logToFile("Cleared active session cookies.");
  } catch (err) {
    logToFile("Failed to delete session cookie:", err);
  }
}

async function syncCookiesToSession(cookieStr) {
  if (!cookieStr || !cookieStr.trim()) return;
  try {
    const authSession = session.fromPartition("persist:google_auth");
    const pairs = cookieStr.split(";");
    for (const pair of pairs) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name || !value) continue;
      try {
        await authSession.cookies.set({
          url: "https://music.youtube.com",
          domain: ".youtube.com",
          name,
          value,
          path: "/",
          secure: true,
          httpOnly:
            name.toLowerCase().includes("sapisid") ||
            name.toLowerCase().includes("ssid") ||
            name.startsWith("__Secure"),
        });
      } catch (e) {}
    }
    logToFile(
      "Synced session cookies to Chromium persist:google_auth partition.",
    );
  } catch (err) {
    logToFile("Error syncing cookies to partition:", err.message);
  }
}

let streamClient = null;
let streamInitPromise = null;
async function getStreamClient() {
  if (streamClient) return streamClient;
  if (!streamInitPromise) {
    streamInitPromise = (async () => {
      try {
        const { Innertube, Platform } = await getInnertube();
        if (Platform?.shim) {
          Platform.shim.eval = (data, env) => {
            const code =
              typeof data === "object" && data.output ? data.output : data;
            return vm.runInNewContext(code, env || {});
          };
        }
        // Dedicated guest Innertube instance without user cookies:
        // YouTube stream endpoints (VISIONOS, ANDROID_VR, IOS) return HTTP 400 if user web cookies are attached.
        // A clean guest session provides authentic visitorData and returns unenciphered stream URLs.
        streamClient = await Innertube.create();
        logToFile(
          "Dedicated stream extractor Innertube initialized with clean visitorData.",
        );
        return streamClient;
      } catch (err) {
        logToFile(
          "Failed to initialize stream extractor Innertube:",
          err.message,
        );
        streamInitPromise = null;
        throw err;
      }
    })();
  }
  return streamInitPromise;
}

// Initialize YouTube.js client
function initYouTube(cookie = "") {
  initPromise = (async () => {
    try {
      const cleanCookie = sanitizeAndDeduplicateCookie(cookie);
      logToFile(
        "Initializing Innertube with cookie length:",
        cleanCookie ? cleanCookie.length : 0,
      );
      if (cleanCookie) {
        syncCookiesToSession(cleanCookie).catch(() => {});
      }
      const { Innertube, UniversalCache, Platform } = await getInnertube();
      if (Platform?.shim) {
        Platform.shim.eval = (data, env) => {
          const code =
            typeof data === "object" && data.output ? data.output : data;
          return vm.runInNewContext(code, env || {});
        };
      }

      const cacheDir = path.join(
        app.getPath("userData"),
        "yt_cache",
      );
      let cache = null;
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        cache = new UniversalCache(true, cacheDir);
      } catch (e) {
        logToFile("Falling back to memory cache:", e.message);
        cache = new UniversalCache(false);
      }

      yt = await Innertube.create({
        cache: cache,
        cookie: cleanCookie || undefined,
        generate_session_locally: true,
      });

      if (cleanCookie) {
        let parsedProfile = null;

        // Method 1: YouTube Music account_menu (matches AirBeats InnerTube)
        try {
          const res = await yt.actions.execute("/account/account_menu", {
            client: "YTMUSIC",
          });
          const header =
            res?.data?.actions?.[0]?.openPopupAction?.popup
              ?.multiPageMenuRenderer?.header?.activeAccountHeaderRenderer;
          if (header) {
            const name =
              header.accountName?.runs?.[0]?.text ||
              header.accountName?.simpleText ||
              "";
            const email =
              header.channelHandle?.runs?.[0]?.text ||
              header.email?.runs?.[0]?.text ||
              header.email?.simpleText ||
              "";
            const thumbs = header.accountPhoto?.thumbnails || [];
            const photo =
              thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;

            if (name) {
              parsedProfile = {
                name,
                email,
                photo,
                isLoggedIn: true,
              };
              logToFile("Parsed profile via account_menu:", name, email);
            }
          }
        } catch (e) {
          logToFile("account_menu check error:", e.message);
        }

        // Method 2: yt.account.getInfo() fallback
        if (!parsedProfile) {
          try {
            const info = await yt.account.getInfo();
            const accountItem = info?.contents?.contents?.[0];
            const name = accountItem?.account_name?.text || info?.name || "";
            const email =
              accountItem?.account_byline?.text || info?.email || "";
            const photo =
              accountItem?.account_photo?.[0]?.url ||
              info?.photo?.[0]?.url ||
              null;
            if (name) {
              parsedProfile = {
                name,
                email,
                photo,
                isLoggedIn: true,
              };
              logToFile("Parsed profile via getInfo:", name);
            }
          } catch (e) {
            logToFile("yt.account.getInfo fallback error:", e.message);
          }
        }

        userProfile = parsedProfile || {
          name: "YouTube User",
          email: "",
          photo: null,
          isLoggedIn: true,
        };
      } else {
        userProfile = {
          name: null,
          email: null,
          photo: null,
          isLoggedIn: false,
        };
      }

      logToFile(
        "Innertube initialized. Logged in:",
        userProfile.isLoggedIn,
        "User:",
        userProfile.name,
      );
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("auth:changed", userProfile);
      }
      return userProfile;
    } catch (err) {
      logToFile("Error initializing Innertube:", err);
      return userProfile;
    }
  })();

  return initPromise;
}

// Helper to extract artist names reliably
function parseArtistsFromItem(item) {
  if (item.artists && Array.isArray(item.artists) && item.artists.length > 0) {
    const list = item.artists
      .map((a) => ({
        name: (a.name || a.toString() || "").trim(),
        id: a.channel_id || a.id,
      }))
      .filter((a) => a.name && a.name !== "Unknown Artist");
    if (list.length > 0) return list;
  }
  if (item.author) {
    const authName = (
      typeof item.author === "object" ? item.author.name : item.author || ""
    ).trim();
    if (authName && authName !== "Unknown Artist") {
      return [
        { name: authName, id: item.author?.channel_id || item.author?.id },
      ];
    }
  }
  const subText = (
    item.subtitle?.text ||
    item.subtitle?.toString() ||
    item.subtitle ||
    ""
  ).trim();
  if (subText) {
    const parts = subText.split("•").map((p) => p.trim());
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase();
      if (["song", "video", "track", "album", "single", "ep"].includes(first)) {
        return [{ name: parts[1] }];
      }
      return [{ name: parts[0] }];
    } else if (parts.length === 1 && parts[0]) {
      return [{ name: parts[0] }];
    }
  }
  return [{ name: "YouTube Music" }];
}

function getThumbnailUrl(item) {
  if (!item) return null;
  if (typeof item === "string" && item.startsWith("http")) return item;
  const list =
    (Array.isArray(item) ? item : null) ||
    item.thumbnails ||
    (Array.isArray(item.contents) ? item.contents : null) ||
    item.thumbnail?.contents ||
    item.thumbnail?.thumbnails ||
    (Array.isArray(item.thumbnail) ? item.thumbnail : null) ||
    [];
  if (Array.isArray(list) && list.length > 0) {
    // Get the last (highest available) thumbnail URL
    let url =
      [...list]
        .reverse()
        .filter((item) => item?.url)
        .sort(
          (a, b) =>
            (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0),
        )[0]?.url || null;
    if (!url) return null;
    // Ensure high-quality thumbnail by upgrading to hqdefault
    // YouTube thumbnail URL patterns:
    // - i.ytimg.com/vi/{id}/default.jpg (120x90)
    // - i.ytimg.com/vi/{id}/hqdefault.jpg (480x360)
    // - i.ytimg.com/vi/{id}/maxresdefault.jpg (1280x720)
    if (url.includes("i.ytimg.com/vi/")) {
      // Replace existing quality suffix or add hqdefault
      url = url.replace(/\/(?:default|mqdefault)\.jpg$/i, "/hqdefault.jpg");
    } else if (
      url.includes("youtube.com/embed/") ||
      url.includes("youtube.com/watch?v=")
    ) {
      // Extract video ID and add hqdefault
      const videoId =
        url.match(/[?&]v=([^&]+)/)?.[1] ||
        url.match(/\/embed\/([^/?]+)/)?.[1] ||
        "";
      if (videoId) {
        url = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
      }
    }
    return highQualityArtwork(url);
  }
  // Fallback to hqdefault for known YouTube video IDs
  if (
    typeof item === "object" &&
    /^[\w-]{11}$/.test(item.id || "") &&
    !item.thumbnail
  ) {
    return highQualityArtwork(
      "https://i.ytimg.com/vi/" + item.id + "/hqdefault.jpg",
    );
  }
  return null;
}

function normalizeSearchTrack(item) {
  if (!item) return null;
  const id =
    item.id ||
    item.videoId ||
    item.endpoint?.payload?.videoId ||
    item.endpoint?.payload?.browseId ||
    item.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

  const title =
    item.title?.text ||
    item.title?.toString() ||
    (typeof item.title === "string" ? item.title : "") ||
    item.name ||
    "";

  if (!id || !title) return null;

  const artists = parseArtistsFromItem(item);
  const albumName =
    item.album?.name ||
    item.album?.title ||
    (typeof item.album === "string" ? item.album : null);
  const albumId = item.album?.id;

  let durationText = "";
  let durationSeconds = null;
  if (typeof item.duration === "string") {
    durationText = item.duration;
  } else if (item.duration?.text) {
    durationText = item.duration.text;
    durationSeconds = item.duration.seconds || null;
  } else if (item.duration?.seconds) {
    durationSeconds = item.duration.seconds;
    const m = Math.floor(durationSeconds / 60);
    const s = (durationSeconds % 60).toString().padStart(2, "0");
    durationText = `${m}:${s}`;
  }

  const thumbnail =
    getThumbnailUrl(item) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    id,
    title,
    artists: artists.length > 0 ? artists : [{ name: "YouTube Music" }],
    album: albumName ? { name: albumName, id: albumId } : null,
    duration: durationText,
    durationSeconds,
    thumbnail,
    type: item.item_type || item.type || "track",
    isExplicit: hasExplicitBadge(item),
  };
}

function hasExplicitBadge(item) {
  if (item?.isExplicit === true || item?.is_explicit === true || item?.explicit === true) return true;
  const badges = [item?.badges, item?.subtitleBadges, item?.subtitle_badges, item?.menu?.badges];
  return badges.some((value) => /EXPLICIT|MUSIC_EXPLICIT_BADGE|explicitBadge/i.test(JSON.stringify(value || [])));
}

function parseResponsiveListItem(row) {
  if (!row) return null;
  const flex = row.flexColumns || [];
  const col0 =
    flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const col1 =
    flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const col2 =
    flex[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

  const title = col0
    .map((r) => r.text)
    .join("")
    .trim();
  const artistRuns = col1.filter(
    (r) =>
      r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("UC") ||
      !r.text.includes("•"),
  );
  const artistName =
    artistRuns
      .map((r) => r.text)
      .join("")
      .trim() ||
    col1
      .map((r) => r.text)
      .join("")
      .trim();
  const artistId = col1.find((run) =>
    run.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("UC"),
  )?.navigationEndpoint.browseEndpoint.browseId;
  const albumName = col2
    .map((r) => r.text)
    .join("")
    .trim();

  const fixed = row.fixedColumns || [];
  const duration =
    fixed[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs
      ?.map((r) => r.text)
      .join("")
      .trim() || "";

  const thumbs =
    row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumbnail = getThumbnailUrl(
    row.thumbnail?.musicThumbnailRenderer?.thumbnail,
  );

  const videoId =
    row.playlistItemData?.videoId ||
    row.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
      ?.videoId ||
    col0[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
    row.navigationEndpoint?.watchEndpoint?.videoId;

