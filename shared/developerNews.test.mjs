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
