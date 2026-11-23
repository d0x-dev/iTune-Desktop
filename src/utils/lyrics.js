function parseTimestamp(value, frameRate = 30, tickRate = 1) {
  if (!value) return null;
  const offset = value.match(/^([\d.]+)(ms|h|m|s|f|t)$/);
  if (offset)
    return (
      Number(offset[1]) *
      { ms: 0.001, h: 3600, m: 60, s: 1, f: 1 / frameRate, t: 1 / tickRate }[
        offset[2]
      ]
    );
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 4)
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / frameRate;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
}

/* Timed-span extraction adapted from iTune Android TTMLParser, DxV Studio / Dark, GPL-3.0. */
function lyricWords(node, lineStart, lineEnd, time) {
  const words = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      if (child.textContent)
        words.push({ text: child.textContent, start: null, end: null });
      continue;
    }
    if (child.localName === "br") {
      words.push({ text: "\n", start: null, end: null });
      continue;
    }
    const begin = time(child.getAttribute?.("begin"));
    const end = time(child.getAttribute?.("end"));
    if (
      begin != null &&
      !Array.from(child.children || []).some((element) =>
        element.hasAttribute("begin"),
      )
    ) {
      // Apple lyric spans use the song clock. Offset spans are relative to the line.
      const relative = begin < (lineStart || 0);
      const start = begin + (relative ? lineStart || 0 : 0);
      const finish =
        end != null
          ? end + (relative ? lineStart || 0 : 0)
          : start + (time(child.getAttribute("dur")) || 0);
      words.push({
        text: lyricText(child),
        start,
        end: finish > start ? finish : lineEnd,
      });
    } else words.push(...lyricWords(child, lineStart, lineEnd, time));
  }
  return words.some((word) => word.start != null) ? words : [];
}

function lyricText(node) {
  return Array.from(node.childNodes)
    .map((child) =>
      child.nodeType === 3
        ? child.textContent
        : child.localName === "br"
          ? "\n"
          : lyricText(child),
    )
    .join("");
}

export function parseLyrics(source) {
  if (typeof source !== "string" || !source.trim()) return [];
  if (source.trim().startsWith("<")) {
    const document = new DOMParser().parseFromString(source, "application/xml");
    if (document.getElementsByTagName("parsererror").length)
      throw new Error("This lyrics XML file couldn’t be read.");
    const root = document.documentElement;
    const parameter = (name) =>
      Array.from(root.attributes).find(
        (attribute) => attribute.localName === name,
      )?.value;
    const multiplier = (parameter("frameRateMultiplier") || "1 1")
      .split(" ")
      .map(Number);
    const frameRate =
      (Number(parameter("frameRate") || 30) * multiplier[0]) /
      (multiplier[1] || 1);
    const tickRate = Number(parameter("tickRate") || 1);
    const time = (value) => parseTimestamp(value, frameRate, tickRate);
    const paragraphs = Array.from(document.getElementsByTagNameNS("*", "p"));
    if (!paragraphs.length)
      throw new Error("This file needs TTML lyric paragraphs.");
    return paragraphs
      .map((paragraph) => {
