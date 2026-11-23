import { useCallback, useEffect, useRef, useState } from "react";
import { findNewsPopup } from "../../shared/developerNews.mjs";
import { newsInstanceKey } from "../../shared/developerNews.mjs";

const cacheKey = "itune:developer-news";
const dismissalKey = "itune:developer-news-dismissals";

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The live feed still works when storage is unavailable.
  }
}

function readDismissals() {
  const saved = read(dismissalKey, {});
  return {
    lastTimestamp: Number(saved.lastTimestamp) || 0,
    keys: Array.isArray(saved.keys) ? saved.keys : [],
  };
}

export function useDeveloperNews() {
  const [initialItems] = useState(() => {
    const cached = read(cacheKey, []);
    return Array.isArray(cached) ? cached : [];
  });
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [popup, setPopup] = useState(null);
  const pending = useRef(null);

  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    setLoading(true);
    setError(false);
    pending.current = Promise.resolve()
      .then(() => window.api.news.getItems())
      .then((freshItems) => {
        setItems(freshItems);
        write(cacheKey, freshItems);
        return freshItems;
      })
      .catch(() => {
        setError(true);
        return null;
      })
      .finally(() => {
        pending.current = null;
        setLoading(false);
      });
    return pending.current;
  }, []);

  useEffect(() => {
    let active = true;
    refresh().then((freshItems) => {
      if (active) setPopup(findNewsPopup(freshItems ?? initialItems, readDismissals()));
    });
    return () => { active = false; };
  }, [refresh, initialItems]);

  function dismissPopup() {
    if (!popup) return;
    const { lastTimestamp, keys } = readDismissals();
    write(dismissalKey, {
      lastTimestamp: Math.max(lastTimestamp, popup.timestamp),
      keys: [...new Set([...keys, newsInstanceKey(popup)])],
    });
    setPopup(null);
  }

  return { items, loading, error, popup, refresh, dismissPopup };
}
