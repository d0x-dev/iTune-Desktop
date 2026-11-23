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

function isITuneNews({ tag, id, title, message, actionUrl }) {
  if ([tag, id, title, message, actionUrl].some((field) => /itune/i.test(field)))
    return true;
  return /^(announcement|news)?$/i.test(tag) && !/airbeats/i.test(`${title} ${message}`);
}

export function parseDeveloperNews(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      boolean(payload.success, true) === false || payload.error ||
      ("news" in payload && !Array.isArray(payload.news))) {
    throw new Error("Invalid news feed");
  }

  return Object.entries(payload.news ?? payload)
    .filter(([, item]) => item && typeof item === "object" && !Array.isArray(item))
    .map(([key, item]) => ({
      id: String(item.id ?? key).trim(),
      title: string(item.title).trim(),
      message: string(item.message ?? item.content),
      author: string(item.author).trim() || string(item.authorName).trim(),
      imageUrl: newsWebUrl(item.imageUrl),
      actionUrl: newsWebUrl(item.actionUrl),
      actionText: string(item.actionText).trim(),
      tag: string(item.tag).trim(),
      timestamp: Math.max(0, number(item.timestamp)),
      priority: number(item.priority),
      showPopup: boolean(item.showPopup, false),
      active: boolean(item.active, boolean(item.isActive, true)),
    }))
    .filter((item) => item.active && (item.title || item.message.trim()) && isITuneNews(item))
    .sort((left, right) => right.priority - left.priority || right.timestamp - left.timestamp);
}

export async function fetchDeveloperNews() {
  const response = await fetch(NEWS_URL, {
    headers: { "Cache-Control": "no-cache" },
    credentials: "omit",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
  return parseDeveloperNews(await response.json());
}

export const newsInstanceKey = ({ id, timestamp }) => JSON.stringify([id, timestamp]);

export function findNewsPopup(items, { lastTimestamp = 0, keys = [] } = {}) {
  return items.find((item) =>
    item.showPopup && item.id &&
    (!lastTimestamp || item.timestamp > lastTimestamp) &&
    !keys.includes(newsInstanceKey(item)),
  ) ?? null;
}
