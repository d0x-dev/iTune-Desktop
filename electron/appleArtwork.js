/* Ported from iTune Android AppleArtistArt, AppleCatalogue, and CanvasRepository.
 * Originally created by DxV Studio / Dark. Credits DxV Studio, AirBeats, Dark. GPL-3.0.
 */
const cache = new Map();
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const matchKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\$/g, "s")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
const titleKey = (value) =>
  matchKey(
    String(value || "")
      .split(" (")[0]
      .split(" [")[0]
      .replace(/ - (Single|EP)$/i, ""),
  );
async function get(url, json = false, headers = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, ...headers },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  return json ? response.json() : response.text();
}
let tokenRequest;
let tokenExpiry = 0;
async function publicCatalogToken() {
  if (tokenRequest && Date.now() < tokenExpiry - 60000) return tokenRequest;
  tokenExpiry = Date.now() + 300000;
  tokenRequest = (async () => {
    const html = await get("https://music.apple.com/us/browse");
    const scripts = [
      ...new Set(
