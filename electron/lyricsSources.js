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
