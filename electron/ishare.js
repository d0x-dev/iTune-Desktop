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
