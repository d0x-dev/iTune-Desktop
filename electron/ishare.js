const PRIMARY_BACKEND_URL = "https://listentogether.airbeats.org";
const FALLBACK_BACKEND_URL = "https://listentogether.fdar606.workers.dev";

let activeBaseUrl = PRIMARY_BACKEND_URL;

const META_PREFIX = "__AB_META__:";
const QUEUE_PREFIX = "__AB_Q";

function cleanQueueTitle(value, length) {
  return String(value || "Queued track")
    .replace(/[;:&#]/g, " ")
    .trim()
    .slice(0, length);
}

function encodeStateForOnline(state = {}) {
  const queue = Array.isArray(state.queue) ? state.queue : [];
  const settings = state.settings || {};
  const cleanArtists = (Array.isArray(state.artists) ? state.artists : [])
    .filter((artist) => !String(artist).startsWith("__AB_"));
  const artists = [String(cleanArtists[0] || "iShare").trim().slice(0, 35)];
  let meta = `${META_PREFIX}pb=${settings.allowGuestsToControlPlayback ? "1" : "0"}`;
  meta += `&tr=${settings.allowGuestsToAddTracks === false ? "0" : "1"}`;
  if (state.durationMs > 0) meta += `&dur=${Math.round(state.durationMs)}`;
  if (state.totalQueueSize > 0)
    meta += `&qs=${Math.round(state.totalQueueSize)}`;
  artists.push(meta.slice(0, 118));
  queue
    .slice(0, 18)
    .reduce((chunks, item, index) => {
      const chunk = Math.floor(index / 3);
      chunks[chunk] ||= [];
      chunks[chunk].push(item);
      return chunks;
    }, [])
    .slice(0, 6)
    .forEach((items, index) => {
      const payload = items
        .map((item) => `${item.id || item.songId}:${cleanQueueTitle(item.title, 20)}`)
        .join(";");
      artists.push(`${QUEUE_PREFIX}${index}:${payload}`.slice(0, 115));
    });
  const rawThumbnail = String(state.thumbnailUrl || "").split("#")[0];
  const thumbnailQueue = queue
    .slice(0, 15)
    .map(
      (item) =>
        `${item.id || item.songId}:${cleanQueueTitle(item.title, 15)}`,
    )
    .join(";");
  return {
    ...state,
    artists,
    thumbnailUrl:
      rawThumbnail && thumbnailQueue
        ? `${rawThumbnail}#Q=${thumbnailQueue}`.slice(0, 580)
        : rawThumbnail,
    settings,
    queue,
  };
}

function decodeSession(session = {}) {
  const state = session.state;
  if (!state) return session;
  const artists = Array.isArray(state.artists) ? state.artists : [];
  const cleanArtists = [];
  const queue = [
    ...(Array.isArray(state.queue) ? state.queue : []),
    ...(Array.isArray(session.queue) ? session.queue : []),
  ];
  const settings = {
    allowGuestsToControlPlayback: false,
    allowGuestsToAddTracks: true,
    ...(session.settings || {}),
    ...(state.settings || {}),
  };
  let durationMs = Number(state.durationMs) || 0;
  let totalQueueSize = Number(state.totalQueueSize) || 0;
  const addEncodedQueue = (payload) => {
    String(payload || "")
      .split(";")
      .forEach((entry) => {
        const divider = entry.indexOf(":");
        if (divider <= 0) return;
        const id = entry.slice(0, divider).trim();
        const title = entry.slice(divider + 1).trim() || "Queued track";
        if (id)
          queue.push({
            id,
            title,
            artist: "iShare",
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
            durationMs: 0,
          });
      });
  };
  const rawThumbnail = String(state.thumbnailUrl || "");
  if (rawThumbnail.includes("#Q=")) addEncodedQueue(rawThumbnail.split("#Q=")[1]);
  artists.forEach((artist) => {
    const value = String(artist || "");
    if (value.startsWith(META_PREFIX)) {
      const params = new URLSearchParams(value.slice(META_PREFIX.length));
      if (params.has("pb"))
        settings.allowGuestsToControlPlayback = params.get("pb") === "1";
      if (params.has("tr"))
        settings.allowGuestsToAddTracks = params.get("tr") !== "0";
      durationMs = Number(params.get("dur")) || durationMs;
      totalQueueSize = Number(params.get("qs")) || totalQueueSize;
    } else if (value.startsWith(QUEUE_PREFIX)) {
      addEncodedQueue(value.slice(value.indexOf(":") + 1));
    } else if (value) {
      cleanArtists.push(value);
    }
  });
  const seen = new Set();
  const distinctQueue = queue.filter((item) => {
    const id = item?.id || item?.songId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    ...session,
    settings,
    queue: distinctQueue,
    state: {
      ...state,
      artists: cleanArtists,
      thumbnailUrl: rawThumbnail.split("#")[0],
      durationMs,
      totalQueueSize: totalQueueSize || distinctQueue.length,
      settings,
      queue: distinctQueue,
    },
  };
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "iTune Desktop/1.0.0",
      ...options.headers,
    },
    signal: AbortSignal.timeout(6000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data.error || `Listen Together request failed (${response.status})`);
  }
  return data;
}

async function withFallback(pathname, options) {
  const first = activeBaseUrl;
  const second =
    first === PRIMARY_BACKEND_URL ? FALLBACK_BACKEND_URL : PRIMARY_BACKEND_URL;
  try {
    return await request(first, pathname, options);
  } catch (firstError) {
    try {
      const result = await request(second, pathname, options);
      activeBaseUrl = second;
      return result;
    } catch (secondError) {
      throw new Error(secondError.message || firstError.message);
    }
  }
}

function post(pathname, body) {
  return withFallback(pathname, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

module.exports = {
  create(displayName, state) {
    const encoded = encodeStateForOnline(state);
    return post("/sessions", {
      name: displayName,
      state: encoded,
      settings: encoded.settings,
    }).then(decodeSession);
  },
  join(code, displayName) {
    return post(
      `/sessions/${encodeURIComponent(code.trim().toUpperCase())}/join`,
      { name: displayName },
    ).then(decodeSession);
  },
  get(code) {
    return withFallback(
      `/sessions/${encodeURIComponent(code.trim().toUpperCase())}`,
      { method: "GET" },
    ).then(decodeSession);
  },
  update(code, participantId, state) {
    const encoded = encodeStateForOnline(state);
    return post(
      `/sessions/${encodeURIComponent(code.trim().toUpperCase())}/state`,
      { participantId, state: encoded, settings: encoded.settings },
    ).then(decodeSession);
  },
  leave(code, participantId) {
    return post(
      `/sessions/${encodeURIComponent(code.trim().toUpperCase())}/leave`,
      { participantId },
    ).catch(() => ({ ok: true }));
  },
};
