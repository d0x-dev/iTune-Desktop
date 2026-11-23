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
        [
          ...String(html || "").matchAll(
            /\/assets\/index(?:-legacy)?[~-][A-Za-z0-9_-]+\.js/g,
          ),
        ].map((match) => match[0]),
      ),
    ];
    for (const script of scripts.slice(0, 3)) {
      const body = await get(`https://music.apple.com${script}`);
      for (const match of String(body || "").matchAll(
        /ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      )) {
        try {
          const payload = JSON.parse(
            Buffer.from(match[0].split(".")[1], "base64url").toString(),
          );
          if (payload.exp * 1000 > Date.now() + 60000) {
            tokenExpiry = payload.exp * 1000;
            return match[0];
          }
        } catch {}
      }
    }
    return null;
  })().catch(() => null);
  return tokenRequest;
}
async function catalogMotion(type, id) {
  const token = await publicCatalogToken();
  if (!token) return null;
  const data = await get(
    `https://amp-api.music.apple.com/v1/catalog/us/${type}/${id}?extend=editorialVideo`,
    true,
    { Authorization: `Bearer ${token}`, Origin: "https://music.apple.com" },
  );
  return motionUrl(data?.data?.[0]?.attributes?.editorialVideo);
}
async function cached(key, resolve) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.promise;
  const promise = Promise.resolve()
    .then(resolve)
    .catch(() => null);
  cache.set(key, { promise, expires: Date.now() + 300000 });
  const result = await promise;
  if (result) cache.set(key, { promise, expires: Date.now() + 3600000 });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return result;
}
function fillArtwork(art, width, format = "jpg") {
  if (!art?.url) return null;
  const height =
    art.width && art.height
      ? Math.round((width * art.height) / art.width)
      : width;
  return art.url
    .replace(/\{w\}/g, width)
    .replace(/\{h\}/g, height)
    .replace(/\{c\}/g, "bb")
    .replace(/\{f\}/g, format);
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of Object.values(node)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
function motionUrl(node) {
  if (!node || typeof node !== "object") return null;
  for (const key of [
    "motionArtistSquare1x1",
    "motionDetailSquare",
