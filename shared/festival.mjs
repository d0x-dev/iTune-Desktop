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
