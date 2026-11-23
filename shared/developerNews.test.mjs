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

