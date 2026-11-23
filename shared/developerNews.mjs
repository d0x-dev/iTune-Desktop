/* Feed targeting and popup ordering adapted from iTune Android, GPL-3.0.
 * Originally created by DxV Studio / Dark. Credits: DxV Studio, AirBeats, Dark.
 */
const NEWS_URL = "https://community.airbeats.org/api/community/news";

export function newsWebUrl(value) {
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
      return url.href;
  } catch {
    return "";
  }
  return "";
}

const string = (value) => (typeof value === "string" ? value : "");
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const boolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value))
    return value.toLowerCase() === "true";
  return fallback;
};

