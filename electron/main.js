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

  if (!videoId || !title) return null;

  return {
    id: videoId,
    title,
    artists: [{ name: artistName || "YouTube Music", id: artistId }],
    artistId,
    album: albumName ? { name: albumName } : null,
    duration,
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isExplicit: hasExplicitBadge(row),
  };
}

function extractTracksFromBrowseData(data) {
  const tracks = [];
  const seen = new Set();

  function scan(node) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) scan(item);
      return;
    }

    if (node.musicResponsiveListItemRenderer) {
      const t = parseResponsiveListItem(node.musicResponsiveListItemRenderer);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
      }
      return;
    }

    for (const key of Object.keys(node)) {
      if (
        key === "trackingParams" ||
        key === "frameworkUpdates" ||
        key === "responseContext" ||
        key === "clickTrackingParams" ||
        key === "serviceTrackingParams"
      ) {
        continue;
      }
      scan(node[key]);
    }
  }

  scan(data);
  return tracks;
}

function extractTracksFromSearch(searchRes) {
  const items = [];
  const rawSections = searchRes.results || searchRes.contents || [];

  for (const section of rawSections) {
    if (!section) continue;

    // Case 1: MusicCardShelf (Top Result)
    if (section.type === "MusicCardShelf") {
      const topTitle = section.title?.text || section.title?.toString() || "";
      const topSubtitle =
        section.subtitle?.text || section.subtitle?.toString() || "";
      const artists = parseArtistsFromItem(section);
      const videoId =
        section.id ||
        section.endpoint?.payload?.videoId ||
        section.on_tap?.payload?.videoId ||
        section.buttons?.find((b) => b.endpoint?.payload?.videoId)?.endpoint
          ?.payload?.videoId;
      const albumId =
        section.endpoint?.payload?.playlistId ||
        section.buttons?.find((b) => b.endpoint?.payload?.playlistId)?.endpoint
          ?.payload?.playlistId;

      if (videoId && topTitle) {
        items.push({
          id: videoId,
          title: topTitle,
          artists:
            artists.length > 0
              ? artists
              : [
                  {
                    name: topSubtitle.split("•")[0]?.trim() || "YouTube Music",
                  },
                ],
          album: albumId ? { name: topTitle, id: albumId } : null,
          duration: "",
          durationSeconds: null,
          thumbnail: getThumbnailUrl(section) || null,
          type: "top_result",
        });
      }

      if (Array.isArray(section.contents)) {
        for (const subItem of section.contents) {
          const track = normalizeSearchTrack(subItem);
          if (track) items.push(track);
        }
      }
    }

    // Case 2: ItemSection or MusicShelf
    const sectionItems = section.contents || section.items || [];
    if (Array.isArray(sectionItems) && sectionItems.length > 0) {
      for (const item of sectionItems) {
        const track = normalizeSearchTrack(item);
        if (track) items.push(track);
      }
    }

    // Case 3: Direct item
    if (
      section.type === "MusicResponsiveListItem" ||
      section.id ||
      section.videoId
    ) {
      const track = normalizeSearchTrack(section);
      if (track) items.push(track);
    }
  }

  const seen = new Set();
  return items.filter((track) => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

async function getLibraryItems(filter) {
  const library = await yt.music.getLibrary();
  let page = await library.applyFilter(filter);
  const items = [];
  const seen = new Set();
  while (page) {
    const previousCount = seen.size;
    const shelves = Array.isArray(page.contents)
      ? page.contents
      : [page.contents];
    for (const shelf of shelves) {
      for (const item of shelf?.contents || shelf?.items || []) {
        const normalized = normalizeSearchTrack(item);
        if (normalized && !seen.has(normalized.id)) {
          seen.add(normalized.id);
          items.push(normalized);
        }
      }
    }
    if (!page.has_continuation || seen.size === previousCount) break;
    page = await page.getContinuation();
  }
  return items;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    transparent: true,
    backgroundColor: "#00000000",
    backgroundMaterial: "acrylic",
    frame: false,
    icon: path.join(__dirname, "../dist/app-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  const isDev =
    process.argv.includes("--dev") || process.env.NODE_ENV === "development";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerWindowsMediaIdentity() {
  if (process.platform !== "win32" || !app.isPackaged || !process.env.APPDATA)
    return;

  const shortcutPath = path.join(
    process.env.APPDATA,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "iTune Desktop.lnk",
  );
  const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  try {
    const existing = fs.existsSync(shortcutPath)
      ? shell.readShortcutLink(shortcutPath)
      : null;
    if (existing?.target === executable && existing.appUserModelId === APP_USER_MODEL_ID)
      return;
    const registered = shell.writeShortcutLink(shortcutPath, existing ? "replace" : "create", {
      target: executable,
      cwd: path.dirname(executable),
      description: "iTune Desktop",
      appUserModelId: APP_USER_MODEL_ID,
      icon: executable,
      iconIndex: 0,
    });
    if (!registered) logToFile("Windows media identity registration failed.");
  } catch (error) {
    logToFile("Windows media identity registration failed:", error);
  }
}

// In-App Google Login Browser Popup Window
function openGoogleLogin() {
  return new Promise((resolve) => {
    let isCompleted = false;
    loginResolver = resolve;

    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.focus();
      return;
    }

    const authSession = session.fromPartition("persist:google_auth");

    // Genuine Mobile Android User-Agent: Proven to bypass Google's "This browser or app may not be secure" block in Electron
    const mobileUA =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.137 Mobile Safari/537.36";
    authSession.setUserAgent(mobileUA);

    authWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: "Sign In - YouTube Music",
      parent: mainWindow,
      modal: false,
      autoHideMenuBar: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        session: authSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    authWindow.setMenuBarVisibility(false);
    authWindow.webContents.setUserAgent(mobileUA);
    authWindow.webContents.on("did-create-window", (child) => {
      child.webContents.setUserAgent(mobileUA);
    });

    // YouTube Music Login entrypoint
    const loginUrl =
      "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F";
    authWindow.loadURL(loginUrl, { userAgent: mobileUA });

    let checkInterval = null;
    let authSettleTimer = null;

    const checkCookies = async () => {
      if (!authWindow || authWindow.isDestroyed() || isCompleted) return;
      try {
        const currentUrl = authWindow.webContents.getURL() || "";

        // CRITICAL FIX: Only capture once the user has finished Google auth and redirected to music.youtube.com!
        // Never close or capture while still on accounts.google.com!
        if (
          !currentUrl.includes("music.youtube.com") ||
          currentUrl.includes("accounts.google.com")
        ) {
          return;
        }

        const cookies = await authSession.cookies.get({});
        const ytCookies = cookies.filter(
          (c) => c.domain && c.domain.includes("youtube.com"),
        );
        const googleCookies = cookies.filter(
          (c) =>
            c.domain &&
            c.domain.includes("google.com") &&
            !c.domain.includes("youtube.com"),
        );

        // Put google cookies first, then overwrite with youtube cookies to ensure YouTube's SAPISID wins!
        const cookieMap = new Map();
        for (const c of googleCookies) {
          if (c.name && c.value) cookieMap.set(c.name, c.value);
        }
        for (const c of ytCookies) {
          if (c.name && c.value) cookieMap.set(c.name, c.value);
        }

        const hasYtAuth =
          cookieMap.has("SAPISID") &&
          (cookieMap.has("LOGIN_INFO") ||
            cookieMap.has("__Secure-3PAPISID") ||
            cookieMap.has("SSID"));

        if (hasYtAuth && !authSettleTimer) {
          logToFile(
            "Detected valid YouTube auth cookies. Waiting 1.2s for session to fully settle...",
          );
          authSettleTimer = setTimeout(async () => {
            if (!authWindow || authWindow.isDestroyed() || isCompleted) return;
            isCompleted = true;
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }

            logToFile(
              "Google login completed! Building clean deduplicated YouTube Music session cookies.",
            );
            const finalCookies = await authSession.cookies.get({});
            const finalYt = finalCookies.filter(
              (c) => c.domain && c.domain.includes("youtube.com"),
            );
            const finalGoogle = finalCookies.filter(
              (c) =>
                c.domain &&
                c.domain.includes("google.com") &&
                !c.domain.includes("youtube.com"),
            );

            const finalMap = new Map();
            for (const c of finalGoogle) {
              if (c.name && c.value) finalMap.set(c.name, c.value);
            }
            for (const c of finalYt) {
              if (c.name && c.value) finalMap.set(c.name, c.value);
            }

            const cleanCookieString = Array.from(finalMap.entries())
              .map(([k, v]) => `${k}=${v}`)
              .join("; ");

            saveCookie(cleanCookieString);
            const profile = await initYouTube(cleanCookieString);

            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("auth:changed", profile);
            }

            if (authWindow && !authWindow.isDestroyed()) {
              authWindow.destroy();
            }
            authWindow = null;

            if (loginResolver) {
              loginResolver(profile);
              loginResolver = null;
            }
          }, 1200);
        }
      } catch (err) {
        logToFile("Error checking login cookies:", err);
      }
    };

    checkInterval = setInterval(checkCookies, 1000);

    authWindow.webContents.on("did-navigate", async () => {
      await checkCookies();
    });

    authWindow.webContents.on("did-frame-navigate", async () => {
      await checkCookies();
    });

    authWindow.webContents.on("did-finish-load", async () => {
      await checkCookies();
    });

    authWindow.on("closed", () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (authSettleTimer) {
        clearTimeout(authSettleTimer);
        authSettleTimer = null;
      }
      authWindow = null;
      if (!isCompleted && loginResolver) {
        loginResolver(userProfile);
        loginResolver = null;
      }
    });
  });
}

// Register IPC handlers
function registerIpcHandlers() {
  ipcMain.handle("updates:getInfo", async () => ({
    name: app.getName(),
    version: app.getVersion(),
    appPath: app.getAppPath(),
    platform: process.platform,
    architecture: process.arch,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    releasesUrl: githubUpdates.RELEASES_PAGE,
  }));
  ipcMain.handle("updates:check", async () => {
    try {
      const result = await githubUpdates.checkForUpdates(app.getVersion());
      if (!result.updateAvailable) return result;
      const updateAsset = githubUpdates.findPlatformUpdateAsset(
        result.latestRelease?.assets || [],
        process.platform,
      );
      if (!updateAsset) return { ...result, downloadUnavailable: true };
      const updateDirectory = path.join(app.getPath("userData"), "updates");
      const destination = path.join(updateDirectory, path.basename(updateAsset.name));
      const existing = await fs.promises.stat(destination).catch(() => null);
      if (existing?.isFile() && existing.size > 0 && (!updateAsset.size || existing.size === updateAsset.size)) {
        return { ...result, downloadedAsset: updateAsset.name };
      }
      try {
        await githubUpdates.downloadReleaseAsset(updateAsset, destination, (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("updates:downloadProgress", {
              assetName: updateAsset.name,
              ...progress,
            });
          }
        });
      } catch (error) {
        return { ...result, downloadError: error.message };
      }
      return { ...result, downloadedAsset: updateAsset.name };
    } catch (error) {
      return { ok: false, error: error.message, releasesUrl: githubUpdates.RELEASES_PAGE };
    }
  });
  ipcMain.handle("updates:download", async (_event, tag, assetName) => {
    try {
      if (typeof tag !== "string" || typeof assetName !== "string") {
        throw new Error("Choose a file from a GitHub release.");
      }
      const { release, asset } = await githubUpdates.findReleaseAsset(tag, assetName);
      const safeName = path.basename(asset.name);
      if (safeName !== asset.name) throw new Error("The release file name is invalid.");
      const destination = path.join(app.getPath("userData"), "updates", safeName);
      await githubUpdates.downloadReleaseAsset(asset, destination, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("updates:downloadProgress", {
            assetName: safeName,
            ...progress,
          });
        }
      });
      return { ok: true, tag: release.tag, assetName: safeName };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("updates:install", async (_event, assetName) => {
    if (typeof assetName !== "string" || path.basename(assetName) !== assetName) {
      return { ok: false, error: "Choose a downloaded setup file." };
    }
    const installerPath = path.join(app.getPath("userData"), "updates", assetName);
    try {
      const installer = await fs.promises.stat(installerPath);
      if (!installer.isFile() || installer.size === 0) {
        throw new Error("Download the setup file before installing it.");
      }
      if (process.platform === "linux" && /\.appimage$/i.test(assetName)) {
        await fs.promises.chmod(installerPath, 0o755);
      }
      const error = await shell.openPath(installerPath);
      return error ? { ok: false, error } : { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("updates:openReleases", async () => {
    await shell.openExternal(githubUpdates.RELEASES_PAGE);
  });
  ipcMain.handle("updates:openRepository", async () => {
    await shell.openExternal("https://github.com/d0x-dev/iTune-Desktop");
  });
  ipcMain.handle("updates:openLicense", async () => {
    await shell.openExternal("https://www.gnu.org/licenses/gpl-3.0.html");
  });
  ipcMain.handle("festival:getConfig", async () => {
    const { fetchFestivalConfig } = await import("../shared/festival.mjs");
    return fetchFestivalConfig(app.getVersion());
  });
  ipcMain.handle("news:getItems", async () => {
    const { fetchDeveloperNews } = await import("../shared/developerNews.mjs");
    return fetchDeveloperNews();
  });
  ipcMain.handle("news:openLink", async (_event, value) => {
    const { newsWebUrl } = await import("../shared/developerNews.mjs");
    const url = newsWebUrl(value);
    if (url) await shell.openExternal(url);
  });
  ipcMain.handle("ishare:create", async (_event, displayName, state) => {
    try {
      return { ok: true, session: await ishare.create(displayName, state) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("ishare:join", async (_event, code, displayName) => {
    try {
      return { ok: true, session: await ishare.join(code, displayName) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("ishare:get", async (_event, code) => {
    try {
      return { ok: true, session: await ishare.get(code) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle(
    "ishare:update",
    async (_event, code, participantId, state) => {
      try {
        return {
          ok: true,
          session: await ishare.update(code, participantId, state),
        };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  );
  ipcMain.handle("ishare:leave", async (_event, code, participantId) => {
    await ishare.leave(code, participantId);
    return { ok: true };
  });
  ipcMain.handle("ishare:lanStart", async (_event, options) => {
    try {
      return { ok: true, session: await ishareLan.startHost(options) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("ishare:lanStop", async () => {
    ishareLan.stopHost();
    return { ok: true };
  });
  ipcMain.handle("ishare:lanUpdate", async (_event, state, settings) => {
    try {
      return { ok: true, ...ishareLan.updateHost(state, settings) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("ishare:lanScan", async () => {
    try {
      return { ok: true, ...(await ishareLan.scan()) };
    } catch (error) {
      return { ok: false, hosts: [], error: error.message };
    }
  });
  ipcMain.handle("ishare:lanJoin", async (_event, address, displayName) => {
    try {
      return {
        ok: true,
        session: await ishareLan.join(address, displayName),
        address: ishareLan.normalizeAddress(address),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("ishare:lanGet", async (_event, address, participantId) => {
    try {
      return { ok: true, session: await ishareLan.get(address, participantId) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle(
    "ishare:lanAction",
    async (_event, address, participantId, action, payload) => {
      try {
        return {
          ok: true,
          session: await ishareLan.action(
            address,
            participantId,
            action,
            payload,
          ),
        };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  );
  ipcMain.handle("ishare:lanLeave", async (_event, address, participantId) => {
    await ishareLan.leave(address, participantId);
    return { ok: true };
  });
  ipcMain.handle("artwork:artist", async (_event, metadata) =>
    appleArtwork.artistArtwork(metadata.name, metadata.titles),
  );
  ipcMain.handle("artwork:album", async (_event, metadata) =>
    appleArtwork.albumArtwork(metadata.title, metadata.artist),
  );
  ipcMain.handle("artwork:canvas", async (_event, metadata) =>
    appleArtwork.trackCanvas(metadata),
  );
  ipcMain.handle("artwork:signature", async (_event, metadata) =>
    appleArtwork.signatureArtwork(metadata.name, metadata.baseUrl),
  );
  ipcMain.handle("auth:login", async () => {
    const profile = await openGoogleLogin();
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle("auth:importCookie", async (_event, cookieStr) => {
    if (!cookieStr || !cookieStr.trim())
      return { ok: false, error: "Empty cookie string" };
    saveCookie(cookieStr.trim());
    const profile = await initYouTube(cookieStr.trim());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:changed", profile);
    }
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle("auth:logout", async () => {
    clearSavedCookie();
    await session.fromPartition("persist:google_auth").clearStorageData();
    const profile = await initYouTube("");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:changed", profile);
    }
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle("auth:status", async () => {
    if (initPromise) {
      await initPromise;
    }
    return userProfile;
  });

  // Legacy Player IPC Handlers (Renderer manages playback directly via HTML5 audio)
  ipcMain.handle("player:loadTrack", async () => ({ ok: true }));
  ipcMain.handle("player:play", async () => true);
  ipcMain.handle("player:pause", async () => true);
  ipcMain.handle("player:next", async () => {});
  ipcMain.handle("player:previous", async () => {});
  ipcMain.handle("player:seek", async () => {});
  ipcMain.handle("player:setVolume", async () => {});

  // YouTube Music Handlers
  ipcMain.handle("yt:search", async (_event, { query, type }) => {
    if (initPromise) await initPromise;
    if (!yt) return { results: [] };
    try {
      logToFile("Executing yt.music.search for query:", query, "type:", type);
      const searchRes = await yt.music.search(
        query,
        type ? { type } : undefined,
      );
      const items = extractTracksFromSearch(searchRes);
      if (items.length > 0) {
        logToFile(`Search found ${items.length} tracks for query: ${query}`);
        return { results: items };
      }

      // Intermediate fallback: direct InnerTube /search with YTMUSIC client
      try {
        const directSearch = await yt.actions.execute("/search", {
          query,
          client: "YTMUSIC",
        });
        if (directSearch?.data) {
          const directItems = extractTracksFromBrowseData(directSearch.data);
          if (directItems.length > 0) {
            logToFile(
              `Direct /search found ${directItems.length} tracks for query: ${query}`,
            );
            return { results: directItems };
          }
        }
      } catch (e) {}
    } catch (err) {
      logToFile("yt.music.search error, trying fallback:", err?.message || err);
    }

    // Fallback: yt.search (Standard YouTube search that never fails)
    try {
      logToFile("Running fallback yt.search for query:", query);
      const fallbackRes = await yt.search(query, { type: "video" });
      const rawVideos = fallbackRes.videos || fallbackRes.results || [];
      const fallbackItems = rawVideos
        .map((v) => ({
          id: v.id,
          title: v.title?.text || v.title?.toString() || "Track",
          artists: parseArtistsFromItem(v),
          thumbnail:
            getThumbnailUrl(v) ||
            `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          duration: v.duration?.text || "",
          durationSeconds: v.duration?.seconds || null,
          type: "track",
        }))
        .filter((t) => t.id && t.title);

      logToFile(
        `Fallback search found ${fallbackItems.length} tracks for query: ${query}`,
      );
      return { results: fallbackItems };
    } catch (fbErr) {
      logToFile("Fallback search also failed:", fbErr?.message || fbErr);
      return { results: [], error: fbErr?.message || "Search failed" };
    }
  });

  ipcMain.handle("yt:getSearchSuggestions", async (_event, query) => {
    if (initPromise) await initPromise;
    if (!yt) return { suggestions: [] };
    try {
      const q = typeof query === "string" ? query : "";
      const sections = await yt.music.getSearchSuggestions(q);
      const suggestions = [];

      for (const sec of sections || []) {
        for (const item of sec.contents || []) {
          const text =
            item.suggestion?.text ||
            item.suggestion?.toString() ||
            item.title?.text ||
            item.title?.toString() ||
            item.endpoint?.payload?.query ||
            "";
          const isHistory = item.type === "HistorySuggestion";

          if (text) {
            suggestions.push({
              text,
              isHistory,
              type: item.type,
            });
          }
        }
      }

      const seen = new Set();
      const deduped = suggestions.filter((s) => {
        const lower = s.text.toLowerCase().trim();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });

      return { suggestions: deduped };
    } catch (err) {
      logToFile("getSearchSuggestions error:", err);
      return { suggestions: [], error: err.message };
    }
  });

  ipcMain.handle("yt:likeSong", async (_event, videoId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: "InnerTube not ready" };
    try {
      logToFile("Liking song on YouTube:", videoId);
      const res = await yt.actions.execute("/like/like", {
        target: { videoId },
        client: "YTMUSIC",
      });
      if (res?.status_code >= 400 || res?.data?.error) throw new Error(res?.data?.error?.message || `HTTP ${res.status_code}`);
      return { ok: true, status: res?.status_code || 200 };
    } catch (err) {
      logToFile("Error liking song:", err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("yt:unlikeSong", async (_event, videoId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: "InnerTube not ready" };
    try {
      logToFile("Unliking song on YouTube:", videoId);
      const res = await yt.actions.execute("/like/removelike", {
        target: { videoId },
        client: "YTMUSIC",
      });
      if (res?.status_code >= 400 || res?.data?.error) throw new Error(res?.data?.error?.message || `HTTP ${res.status_code}`);
      return { ok: true, status: res?.status_code || 200 };
    } catch (err) {
      logToFile("Error unliking song:", err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("yt:subscribeArtist", async (_event, channelId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: "InnerTube not ready" };
    try {
      logToFile("Subscribing to artist channel:", channelId);
      const res = await yt.actions.execute("/subscription/subscribe", {
        channelIds: [channelId],
        client: "YTMUSIC",
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile("Error subscribing to artist:", err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("yt:unsubscribeArtist", async (_event, channelId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: "InnerTube not ready" };
    try {
      logToFile("Unsubscribing from artist channel:", channelId);
      const res = await yt.actions.execute("/subscription/unsubscribe", {
        channelIds: [channelId],
        client: "YTMUSIC",
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile("Error unsubscribing from artist:", err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(
    "yt:createPlaylist",
    async (_event, { title, videoIds, description }) => {
      if (initPromise) await initPromise;
      if (!yt) return { ok: false, error: "InnerTube not ready" };
      try {
        logToFile("Creating playlist on YouTube Music:", title);
        const res = await yt.playlist.create(title, videoIds || []);
        return {
          ok: true,
          playlistId: res.playlist_id,
          status: res.status_code || 200,
        };
      } catch (err) {
        logToFile("Error creating playlist:", err);
        return { ok: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "yt:addToPlaylist",
    async (_event, { playlistId, videoIds }) => {
      if (initPromise) await initPromise;
      if (!yt) return { ok: false, error: "InnerTube not ready" };
      try {
        logToFile("Adding videos to playlist:", playlistId, videoIds);
        let targetId = playlistId;
        if (targetId.startsWith("VL")) targetId = targetId.substring(2);

        const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
        const actions = ids.map((vId) => ({
          addedVideoId: vId,
          action: "ACTION_ADD_VIDEO",
        }));

        try {
          const editRes = await yt.actions.execute("/browse/edit_playlist", {
            playlistId: targetId,
            actions,
            client: "YTMUSIC",
          });
          return { ok: true, result: editRes.data };
        } catch (innerErr) {
          // Fallback to yt.playlist.addVideos
          const res = await yt.playlist.addVideos(targetId, ids);
          return { ok: true, result: res };
        }
      } catch (err) {
        logToFile("Error adding to playlist:", err);
        return { ok: false, error: err.message };
      }
    },
  );

  ipcMain.handle("yt:deletePlaylist", async (_event, playlistId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: "InnerTube not ready" };
    try {
      logToFile("Deleting playlist on YouTube Music:", playlistId);
      let targetId = playlistId;
      if (targetId.startsWith("VL")) targetId = targetId.substring(2);
      const res = await yt.actions.execute("/playlist/delete", {
        playlistId: targetId,
        client: "YTMUSIC",
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile("Error deleting playlist:", err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("yt:getHome", async (_event, options) => {
    if (initPromise) await initPromise;
    if (!yt) return { sections: [] };
    try {
      const browseId = options?.browseId || "FEmusic_home";
      const group =
        {
          FEmusic_home: "feed",
          FEmusic_explore: "trending",
          FEmusic_charts: "charts",
          FEmusic_non_music_audio: "podcasts",
        }[browseId] || "feed";
      let cache = homeRequests.get(yt);
      if (!cache) {
        cache = new Map();
        homeRequests.set(yt, cache);
      }
      const load = async (continuation) => {
        const key = `${browseId}:${continuation || "first"}`;
        const cached = cache.get(key);
        if (cached && Date.now() - cached.time < 120000) return cached.promise;
        const promise = yt.actions
          .execute("/browse", {
            ...(continuation ? { continuation } : { browseId }),
            client: "YTMUSIC",
          })
          .then((response) =>
            parseHomePage(response.data, key, group, highQualityArtwork),
          );
        cache.set(key, { promise, time: Date.now() });
        try {
          return await promise;
        } catch (error) {
          cache.delete(key);
          throw error;
        }
      };
      const page = await load(options?.continuation);
      if (options) return page;
      const sections = [...page.sections];
      const tokens = new Set();
      let continuation = page.continuation;
      for (
        let index = 0;
        continuation && index < 4 && !tokens.has(continuation);
        index++
      ) {
        tokens.add(continuation);
        try {
          const more = await load(continuation);
          sections.push(...more.sections);
          continuation = more.continuation;
        } catch {
          break;
        }
      }
      return { sections, continuation };
    } catch (err) {
      logToFile("Get Home Feed error:", err);
      return { sections: [], error: err.message };
    }
  });

  ipcMain.handle("yt:getRadioQueue", async (_event, videoId, playlistId) => {
    if (initPromise) await initPromise;
    if (!yt) return { tracks: [] };
    try {
      const response = await yt.actions.execute("/next", {
        videoId,
        playlistId: playlistId || `RDAMVM${videoId}`,
        client: "YTMUSIC",
        enablePersistentPlaylistPanel: true,
      });
      return { tracks: parseRadioTracks(response.data, highQualityArtwork) };
    } catch (error) {
      return { tracks: [], error: error.message };
    }
  });

  ipcMain.handle("yt:getPlaylists", async () => {
    if (initPromise) await initPromise;
    if (!yt) return { playlists: [] };
    try {
      logToFile("Fetching user playlists via FEmusic_liked_playlists");
      try {
        const res = await yt.actions.execute("/browse", {
          browseId: "FEmusic_liked_playlists",
          client: "YTMUSIC",
        });
        const gridItems =
          res?.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
            ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
            ?.gridRenderer?.items || [];

        const playlists = [];
        for (const item of gridItems) {
          const r = item.musicTwoRowItemRenderer;
          if (!r) continue;
          const title = r.title?.runs?.[0]?.text || r.title?.text || "";
          if (!title || title.toLowerCase() === "new playlist") continue; // Skip create button

          const browseId = r.navigationEndpoint?.browseEndpoint?.browseId || "";
          let playlistId = browseId;
          if (playlistId.startsWith("VL")) playlistId = playlistId.substring(2);

          const thumbs =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
          const thumbnail = getThumbnailUrl(
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail,
          );
          const subtitle = r.subtitle?.runs?.map((s) => s.text).join("") || "";

          playlists.push({
            id: playlistId,
            title,
            thumbnail,
            subtitle,
            itemCount: null,
            author: userProfile?.name || "You",
          });
        }

        if (playlists.length > 0) {
          logToFile(
            `Fetched ${playlists.length} playlists via FEmusic_liked_playlists`,
          );
          return { playlists };
        }
      } catch (err) {
        logToFile(
          "FEmusic_liked_playlists browse error, falling back to getLibrary:",
          err.message,
        );
      }

      const library = await yt.music.getLibrary();
      const grid =
        library.contents?.find((c) => c.type === "Grid") ||
        library.contents?.[0];
      const items = grid?.items || [];
      const playlists = items
        .filter((i) => i.item_type === "playlist")
        .map((p) => ({
          id: p.id,
          title: p.title?.text || p.title?.toString() || "Playlist",
          thumbnail: getThumbnailUrl(p) || null,
          itemCount: p.item_count || null,
          author: userProfile?.name || "You",
        }));

      return { playlists };
    } catch (err) {
      logToFile("Get Playlists error:", err);
      return { playlists: [], error: err.message };
    }
  });

  ipcMain.handle("yt:getSongs", async () => {
    if (initPromise) await initPromise;
    if (!yt) return { tracks: [], error: "Music service is unavailable" };
    try {
      return { tracks: await getLibraryItems("Songs") };
    } catch (error) {
      logToFile("Get Songs error:", error.message);
      return { tracks: [], error: error.message };
    }
  });

  ipcMain.handle("yt:getAlbums", async () => {
    if (initPromise) await initPromise;
    if (!yt) return { albums: [], error: "Music service is unavailable" };
    try {
      return {
        albums: (await getLibraryItems("Albums")).map((album) => ({
          ...album,
          type: "album",
        })),
      };
    } catch (error) {
      logToFile("Get Albums error:", error.message);
      return { albums: [], error: error.message };
    }
  });

