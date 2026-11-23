/* Lyrics providers adapted from iTune Android LyricsHelper.
 * DxV Studio / Dark. Credits DxV Studio, AirBeats, Dark. GPL-3.0.
 */
const USER_AGENT = "iTune Desktop/1.0.0";

async function request(url, { timeout = 9000, json = false } = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: json
        ? "application/json"
        : "application/json, text/plain, text/html, */*",
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return json ? response.json() : response.text();
}

function usable(value) {
  return typeof value === "string" && value.trim().length > 12;
}

function result(
  lyrics,
  source,
  synced = /\[\d{1,3}:\d{2}|<tt|<p\s/i.test(lyrics || ""),
  details = {},
) {
  if (!usable(lyrics)) return null;
  return { lyrics: lyrics.trim(), source, synced, ...details };
}

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(official|audio|video|lyrics?|visualizer|remaster(?:ed)?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textMatchScore(expected, actual) {
  const left = normalized(expected);
  const right = normalized(actual);
  if (!left || !right) return 0;
  if (left === right) return 40;
  if (left.includes(right) || right.includes(left)) return 25;
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return (20 * overlap) / Math.max(leftWords.size, rightWords.size, 1);
}

function findLyrics(value, depth = 0) {
  if (depth > 5 || value == null) return null;
  if (typeof value === "string") return usable(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLyrics(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of [
      "ttml",
      "syncedLyrics",
      "synced_lyrics",
      "lyrics",
      "lrc",
      "plainLyrics",
      "plain_lyrics",
      "content",
      "text",
    ]) {
      if (key in value) {
        const found = findLyrics(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const child of Object.values(value)) {
      const found = findLyrics(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function paramsFor(metadata) {
  const params = new URLSearchParams({
    title: metadata.title || "",
    artist: metadata.artist || "",
  });
  if (metadata.duration > 0)
    params.set("duration", Math.round(metadata.duration));
  return params;
}

async function betterLyrics(metadata) {
  if (!metadata.title || !metadata.artist) return null;
  const params = new URLSearchParams({ s: metadata.title, a: metadata.artist });
  if (metadata.duration > 0) params.set("d", Math.round(metadata.duration));
  for (const route of ["getLyrics", "kugou/getLyrics"]) {
    try {
      const body = (
        await request(`https://lyrics-api.boidu.dev/${route}?${params}`, {
          timeout: 6500,
        })
      ).trim();
      const lyrics = body.startsWith("{") ? findLyrics(JSON.parse(body)) : body;
      const found = result(lyrics, "BetterLyrics");
      if (found) return found;
    } catch {}
  }
  return null;
}

async function lrcLib(metadata) {
  if (!metadata.title) return null;
  const params = new URLSearchParams({ track_name: metadata.title });
  if (metadata.artist) params.set("artist_name", metadata.artist);
  const rows = await request(`https://lrclib.net/api/search?${params}`, {
    json: true,
  });
  const target = Number(metadata.duration) || 0;
  const score = (item) => {
    const durationDifference = target && item.duration
      ? Math.abs(Number(item.duration) - target)
      : 8;
    return (
      (item.syncedLyrics ? 80 : 20) +
      textMatchScore(metadata.title, item.trackName) +
      textMatchScore(metadata.artist, item.artistName) -
      Math.min(45, durationDifference * 2.5)
    );
  };
  const ranked = [...rows].sort((a, b) => score(b) - score(a));
  const best = ranked[0];
  if (
    target &&
    best?.duration &&
    Math.abs(Number(best.duration) - target) > 18
  ) return null;
  return result(
    best?.syncedLyrics || best?.plainLyrics,
    "LRC Lib",
    Boolean(best?.syncedLyrics),
    {
      trackName: best?.trackName,
      artistName: best?.artistName,
      duration: Number(best?.duration) || 0,
    },
  );
}

async function kuGou(metadata) {
  const keyword = [metadata.title, metadata.artist].filter(Boolean).join(" - ");
  if (!keyword) return null;
  const search = await request(
    `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=5&showtype=0&keyword=${encodeURIComponent(keyword)}`,
    { json: true },
  );
  for (const song of search?.data?.info || []) {
    if (!song.hash) continue;
    const lyricsSearch = await request(
      `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&hash=${encodeURIComponent(song.hash)}`,
      { json: true },
    ).catch(() => null);
    for (const candidate of lyricsSearch?.candidates || []) {
      const downloaded = await request(
        `https://lyrics.kugou.com/download?ver=1&client=pc&fmt=lrc&id=${encodeURIComponent(candidate.id)}&accesskey=${encodeURIComponent(candidate.accesskey)}`,
        { json: true },
      ).catch(() => null);
      if (!downloaded?.content) continue;
      const lyrics = Buffer.from(downloaded.content, "base64").toString("utf8");
      if (!lyrics.startsWith("krc1")) return result(lyrics, "KuGou", true);
    }
  }
  return null;
}

async function simpMusic(metadata) {
  if (!metadata.videoId) return null;
  const response = await request(
    `https://api-lyrics.simpmusic.org/v1/${encodeURIComponent(metadata.videoId)}`,
    { json: true },
  );
  if (!response?.success) return null;
  const rows = response.data || [];
  const target = Number(metadata.duration) || 0;
  rows.sort(
    (a, b) =>
      Math.abs((a.duration || target) - target) -
      Math.abs((b.duration || target) - target),
  );
  const best = rows.find(
    (row) =>
      (row.syncedLyrics || row.plainLyrics) &&
      (!target || !row.duration || Math.abs(row.duration - target) <= 12),
  );
  return result(
    best?.syncedLyrics || best?.plainLyrics,
    "SimpMusic",
    Boolean(best?.syncedLyrics),
    {
      trackName: best?.trackName || metadata.title,
      artistName: best?.artistName || metadata.artist,
      duration: Number(best?.duration) || 0,
    },
  );
}

async function paxsenix(metadata, route = null, label = "Paxsenix") {
  const base = "https://lyrics.paxsenix.org/";
  const routes = [];
  if (!route && metadata.videoId)
    routes.push(`youtube/lyrics?id=${encodeURIComponent(metadata.videoId)}`);
  if (metadata.title && metadata.artist) {
    const query = `title=${encodeURIComponent(metadata.title)}&artist=${encodeURIComponent(metadata.artist)}`;
    for (const source of route
      ? [route]
      : ["spotify", "musixmatch", "apple-music", "netease"])
      routes.push(`${source}/lyrics?${query}`);
  }
  for (const path of routes) {
    try {
      const body = await request(base + path);
      const lyrics = /^[{[]/.test(body.trim())
        ? findLyrics(JSON.parse(body))
        : body;
      const found = result(lyrics, label);
      if (found) return found;
    } catch {}
  }
  return null;
}

async function unison(metadata) {
  const query = [metadata.title, metadata.artist].filter(Boolean).join(" ");
  const urls = [];
  if (query) {
    const params = new URLSearchParams({ q: query });
    if (metadata.duration > 0)
      params.set("d", Math.round(metadata.duration));
    urls.push(`https://unison.boidu.dev/search?${params}`);
  }
  if (metadata.videoId)
    urls.push(
      `https://unison.boidu.dev/lyrics?v=${encodeURIComponent(metadata.videoId)}`,
    );
  for (const url of urls) {
    try {
      const data = await request(url, { json: true });
      const found = result(findLyrics(data), "Unison");
      if (found) return found;
    } catch {}
  }
  return null;
}

async function portato(metadata) {
  if (!metadata.title || !metadata.artist) return null;
  const data = await request(
    `https://lyrics.portato.app/api/v1/lyrics?${paramsFor(metadata)}`,
    { json: true },
  );
  return result(findLyrics(data), "Portato");
}

async function youLy(metadata) {
  if (!metadata.title || !metadata.artist) return null;
  const mirrors = [
    "https://lyricsplus.binimum.org/",
    "https://lyricsplus.prjktla.my.id/",
    "https://lyricsplus.atomix.one/",
    "https://lyricsplus-seven.vercel.app/",
  ];
  const query = paramsFor(metadata);
