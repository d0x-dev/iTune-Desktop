import { useCallback, useEffect, useRef, useState } from "react";

/* Shelf ordering adapted from iTune Android, DxV Studio / Dark, GPL-3.0. */
export function mergeSections(previous, incoming) {
  const sections = previous.map((section) => ({
    ...section,
    contents: [...section.contents],
  }));
  for (const section of incoming.filter(
    (section) => section.contents?.length,
  )) {
    const key = `${section.title.trim().toLowerCase()}|${section.strapline || ""}`;
    const existing = sections.find(
      (item) =>
        `${item.title.trim().toLowerCase()}|${item.strapline || ""}` === key,
    );
    if (!existing) {
      sections.push(section);
      continue;
    }
    const seen = new Set(
      existing.contents.map((item) => `${item.type}:${item.id}`),
    );
    existing.contents.push(
      ...section.contents.filter((item) => {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }
  return sections;
