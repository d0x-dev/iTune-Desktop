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
  const titleRuns =
    row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
  const title = text(row.title || { runs: titleRuns });
  const subRuns =
    row.subtitle?.runs ||
    row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs ||
    row.longBylineText?.runs ||
    [];
  const meta = metadata(subRuns);
  const nav =
    row.navigationEndpoint ||
    titleRuns?.[0]?.navigationEndpoint ||
    row.onTap ||
    {};
  const browse = nav.browseEndpoint;
  const watch =
    nav.watchEndpoint ||
    findFirst(row.overlay, "watchEndpoint") ||
    findFirst(row.onTap, "watchEndpoint");
  const playlist = nav.watchPlaylistEndpoint;
  let videoId = row.videoId || row.playlistItemData?.videoId || watch?.videoId;
  const browseId = browse?.browseId;
  const playlistId = playlist?.playlistId || watch?.playlistId;
  const pageType =
    browse?.browseEndpointContextSupportedConfigs
      ?.browseEndpointContextMusicConfig?.pageType || "";
  let type = "song";
  if (/ALBUM/.test(pageType) || /^MPRE|^OLAK/.test(browseId || ""))
    type = "album";
  else if (/ARTIST|USER_CHANNEL/.test(pageType) || browseId?.startsWith("UC"))
    type = "artist";
  else if (/PODCAST/.test(pageType) || browseId?.startsWith("MPSP"))
    type = "podcast";
  else if (
    /PLAYLIST/.test(pageType) ||
    /^(VL|PL|RD)/.test(browseId || "") ||
