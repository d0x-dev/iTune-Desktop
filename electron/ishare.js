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
