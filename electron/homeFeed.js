/* Ported from iTune Android HomeFeedParser / HomeFeedRepository.
 * Originally created by DxV Studio / Dark. Credits DxV Studio, AirBeats, Dark. GPL-3.0.
 */
function findFirst(node, key) {
  if (!node || typeof node !== "object") return null;
  if (node[key]) return node[key];
  for (const value of Object.values(node)) {
    const found = findFirst(value, key);
    if (found) return found;
  }
  return null;
}
function text(value) {
  if (typeof value === "string") return value;
  return (
    value?.runs
      ?.map((run) => run.text || "")
      .join("")
      .trim() ||
    value?.simpleText ||
    ""
  );
}
function thumbnail(node, upgrade) {
  const thumbnails = findFirst(node, "thumbnails") || [];
  const best = [...thumbnails].sort(
    (a, b) =>
      (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0),
  )[0];
  return best?.url ? upgrade(best.url) : null;
}
function metadata(runs = []) {
  const artists = runs
    .filter((run) =>
      run.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("UC"),
    )
    .map((run) => ({
      name: run.text,
      id: run.navigationEndpoint.browseEndpoint.browseId,
    }));
  const albumRun = runs.find((run) =>
    run.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("MPRE"),
  );
  const subtitle = text({ runs });
  if (!artists.length) {
    const parts = subtitle.split("•").map((part) => part.trim());
    const credit = parts.find(
      (part) =>
        !/^(song|video|album|single|ep|playlist|artist|podcast|episode|show|\d{4}|[\d.,]+.*(views|plays|songs))$/i.test(
          part,
        ),
    );
    if (credit) artists.push({ name: credit });
  }
  return {
    artists,
    artistId: artists[0]?.id,
    subtitle,
    album: albumRun
      ? {
          name: albumRun.text,
          id: albumRun.navigationEndpoint.browseEndpoint.browseId,
        }
      : null,
  };
}
function parseItem(item, upgrade = (url) => url) {
  const row =
    item.musicTwoRowItemRenderer ||
    item.musicResponsiveListItemRenderer ||
    item.musicMultiRowListItemRenderer ||
    item.playlistPanelVideoRenderer;
  if (!row) return null;
