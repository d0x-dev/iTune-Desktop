/* Artwork sizing ported from iTune Android, DxV Studio / Dark, GPL-3.0. */
export function artworkCandidates(source, size = 1440) {
  if (!source || typeof source !== "string") return [];
  let url;
  try {
    url = new URL(source);
  } catch {
    return [source];
  }
  const host = url.hostname;
  if (/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(host)) {
    const base = url.pathname.replace(/=[^/]*$/, "");
    const candidate = (pixels) => {
      const resized = new URL(url);
      resized.pathname = `${base}=w${pixels}-h${pixels}-l90-rj`;
