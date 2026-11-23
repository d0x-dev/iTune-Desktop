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
      return resized.href;
    };
    return [...new Set([candidate(size), candidate(768), source])];
  }
  if (/(^|\.)ytimg\.com$/.test(host) && /\/vi(?:_webp)?\//.test(url.pathname)) {
    const base = url.pathname.replace(/\/[^/]+\.(jpg|webp)$/, "");
    return [
      ...new Set(
        ["maxresdefault", "sddefault", "hqdefault"]
          .map((quality) => `${url.origin}${base}/${quality}.jpg`)
          .concat(source),
      ),
    ];
  }
  if (host.endsWith(".mzstatic.com")) {
    const resized = source
      .replace(/\{w\}/g, String(size))
      .replace(/\{h\}/g, String(size))
      .replace(/\{c\}/g, "bb")
      .replace(/\{f\}/g, "jpg")
      .replace(
        /\/\d+x\d+([a-z]*)\.(jpg|png|webp)(\?|$)/,
        `/${size}x${size}$1.$2$3`,
      );
    return [...new Set([resized, source])];
  }
  return [source];
}

export function highQualityArtwork(source, size = 1440) {
  return artworkCandidates(source, size)[0] || null;
}
