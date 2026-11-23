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
    "motionSquareVideo1x1",
    "motionDetailTall",
    "motionTallVideo3x4",
    "motionDetailRaw",
  ]) {
    const clip = find(node, (item) => !!item[key])?.[key];
    const url = clip?.video || clip?.videoUrl || clip?.hlsUrl || clip?.url;
    if (url?.startsWith("http")) return url;
  }
  return null;
}
function serverData(html) {
  const serialized = html?.match(
    /<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  if (!serialized) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}
function parseArtistArtwork(html) {
  const header = find(serverData(html), (node) =>
    Object.prototype.hasOwnProperty.call(node, "artistLogo"),
  );
  if (!header) return null;
  const hero = (
    header.wideArtwork ||
    header.artwork ||
    header.colorBackdropArtwork
  )?.dictionary;
  const logo = header.artistLogo?.dictionary;
  const clip = header.videoArtwork?.dictionary;
  return {
    heroUrl: fillArtwork(hero, 1440),
    logoUrl: fillArtwork(logo, 1000, "png"),
    logoAspect: logo?.width && logo?.height ? logo.width / logo.height : 2.5,
    videoUrl: motionUrl(clip),
    background: hero?.bgColor ? `#${hero.bgColor.replace(/^#/, "")}` : null,
    accent: hero?.textColor1 ? `#${hero.textColor1.replace(/^#/, "")}` : null,
  };
}
async function artistArtwork(name, titles = []) {
  return cached(`artist:${matchKey(name)}`, async () => {
    const catalogue = new Set(
      titles.map(titleKey).filter((key) => key.length >= 4),
    );
    const search = await get(
      `https://itunes.apple.com/search?${new URLSearchParams({ term: name, entity: "musicArtist", limit: "5" })}`,
      true,
    );
    for (const artist of search?.results || []) {
      if (matchKey(artist.artistName) !== matchKey(name)) continue;
      if (catalogue.size) {
        const lookup = await get(
          `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=song&limit=200`,
          true,
        );
        if (
          !lookup?.results?.some(
            (item) =>
              catalogue.has(titleKey(item.trackName)) ||
              catalogue.has(titleKey(item.collectionName)),
          )
        )
          continue;
      }
      const html = await get(
        (
          artist.artistLinkUrl ||
          `https://music.apple.com/us/artist/${artist.artistId}`
        )
          .split("?")[0]
          .replace("itunes.apple.com", "music.apple.com"),
      );
      const artwork = parseArtistArtwork(html);
      if (artwork?.heroUrl) {
        if (!artwork.videoUrl)
          artwork.videoUrl = await catalogMotion("artists", artist.artistId);
        return artwork;
      }
    }
    return null;
  });
}
async function albumArtwork(title, artist) {
  return cached(`album:${titleKey(title)}:${matchKey(artist)}`, async () => {
    const data = await get(
      `https://itunes.apple.com/search?${new URLSearchParams({ term: `${artist} ${title}`, entity: "album", limit: "10" })}`,
      true,
    );
    const album = (data?.results || []).find(
      (item) =>
        titleKey(item.collectionName) === titleKey(title) &&
        (matchKey(item.artistName) === matchKey(artist) ||
          matchKey(artist).includes(matchKey(item.artistName))),
    );
    if (!album) return null;
    const html = await get(
      album.collectionViewUrl
        .split("?")[0]
        .replace("itunes.apple.com", "music.apple.com"),
    );
    const root = serverData(html);
    const item = find(
      root,
      (item) =>
        String(item.id || item.resourceId || "") ===
          String(album.collectionId) &&
        (item.attributes || item.editorialVideo || item.videoArtwork),
    );
    const attributes = item?.attributes || item;
    const videoUrl =
      motionUrl(
        attributes?.editorialVideo ||
          attributes?.videoArtwork ||
          find(root, (item) => !!item.editorialVideo)?.editorialVideo,
      ) || (await catalogMotion("albums", album.collectionId));
    return {
      heroUrl: album.artworkUrl100?.replace(/100x100[^/.]*\./, "1440x1440bb."),
      videoUrl,
      title: album.collectionName,
      artist: album.artistName,
    };
  });
}
async function trackCanvas(track) {
  if (!track?.title || !track?.artist) return null;
  if (track.album) {
    const artwork = await albumArtwork(track.album, track.artist);
    if (artwork?.videoUrl) return artwork;
  }
  return cached(
    `canvas:${titleKey(track.title)}:${matchKey(track.artist)}`,
    async () => {
      const manifest = await get(
        "https://vivimusicanvas.mkmdevilmi.workers.dev/canvas.json",
        true,
      );
      const match = manifest?.items?.find(
        (item) =>
          titleKey(item.song) === titleKey(track.title) &&
          matchKey(item.artist) === matchKey(track.artist),
      );
      return match?.url?.startsWith("http")
        ? { videoUrl: match.url, title: match.song, artist: match.artist }
        : null;
    },
