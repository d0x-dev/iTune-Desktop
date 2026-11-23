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
