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
