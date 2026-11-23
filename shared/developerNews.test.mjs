import test from "node:test";
import assert from "node:assert/strict";
import {
  findNewsPopup,
  newsInstanceKey,
  newsWebUrl,
  parseDeveloperNews,
} from "./developerNews.mjs";

test("parses iTune-targeted feed items, metadata, and legacy map payloads", () => {
  const items = parseDeveloperNews({
    success: true,
    news: [
      {
        id: "release",
        title: "iTune release",
        content: "**Markdown**",
        authorName: "Dark",
        tag: "Release",
        active: "true",
        showPopup: true,
        timestamp: 2000,
        priority: "100",
      },
      { id: "airbeats", title: "AirBeats release", tag: "Release", active: true },
      { id: "inactive", title: "iTune old", active: false },
      { id: "generic", title: "News", tag: "announcement", active: true },
    ],
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].id, "release");
  assert.equal(items[0].message, "**Markdown**");
  assert.equal(items[0].author, "Dark");
  assert.equal(items[0].priority, 100);
  assert.equal(items[1].id, "generic");

  const cached = parseDeveloperNews({ iTune: { title: "iTune cached post", content: "Saved" } });
  assert.equal(cached[0].id, "iTune");
  assert.equal(cached[0].message, "Saved");
});

test("invalid feeds do not masquerade as an empty announcement list", () => {
  assert.throws(() => parseDeveloperNews(null), /Invalid news feed/);
  assert.throws(() => parseDeveloperNews({ success: false }), /Invalid news feed/);
  assert.throws(() => parseDeveloperNews({ news: {} }), /Invalid news feed/);
});

test("keeps external news links on HTTP or HTTPS", () => {
  assert.equal(newsWebUrl("https://example.com/read"), "https://example.com/read");
  assert.equal(newsWebUrl("javascript:alert(1)"), "");
  assert.equal(newsWebUrl("//example.com/read"), "");
  assert.equal(newsWebUrl("https://user:pass@example.com/read"), "");
});

test("chooses one undismissed popup and advances only to newer news", () => {
  const items = parseDeveloperNews({
    news: [
      { id: "new", title: "iTune new", showPopup: true, active: true, timestamp: 3000, priority: 50 },
      { id: "old", title: "iTune old", showPopup: true, active: true, timestamp: 2000, priority: 200 },
      { id: "post", title: "iTune post", active: true, timestamp: 4000 },
    ],
  });

  assert.equal(findNewsPopup(items)?.id, "old");
  assert.equal(
    findNewsPopup(items, { lastTimestamp: 2000 })?.id,
    "new",
  );
  assert.equal(findNewsPopup(items, { lastTimestamp: 3000 }), null);
  assert.equal(newsInstanceKey(items[0]), JSON.stringify(["old", 2000]));
});
