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
