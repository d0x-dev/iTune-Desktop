/* Festival configuration adapted from iTune Android, DxV Studio / Dark, GPL-3.0. */
const FESTIVAL_URL = "https://raw.githubusercontent.com/d0x-dev/iTune/refs/heads/main/assets/festivals/festivals.json";

const inactive = { enabled: false, text: "", color: "" };

export function parseFestivalConfig(payload, installedVersion) {
  if (!payload || typeof payload !== "object" || payload.festival !== true)
    return inactive;

  const versions = payload.version == null
    ? []
    : (Array.isArray(payload.version) ? payload.version : String(payload.version).split(/[,;|]/))
        .map((value) => String(value).trim().replace(/^v/i, ""))
        .filter(Boolean);
  const fullVersion = installedVersion.trim().replace(/^v/i, "");
  const shortVersion = fullVersion.replace(/\.0$/, "");
  const desktopVersions = new Set([
    `desktop-${fullVersion}`.toLowerCase(),
    `desktop-${shortVersion}`.toLowerCase(),
  ]);
  if (versions.length && !versions.some((version) => desktopVersions.has(version.toLowerCase())))
    return inactive;

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const hex = typeof payload.color === "string" ? payload.color.trim().replace(/^#/, "") : "";
  if (!text || !/^(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(hex))
    return inactive;

  const color = hex.length === 8
    ? `#${hex.slice(2)}${hex.slice(0, 2)}`
    : `#${hex}`;
  return { enabled: true, text, color };
}

export async function fetchFestivalConfig(installedVersion) {
  const url = new URL(FESTIVAL_URL);
  url.searchParams.set("nocache", String(Date.now()));
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Festival configuration returned HTTP ${response.status}`);
  return parseFestivalConfig(await response.json(), installedVersion);
}
