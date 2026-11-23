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
