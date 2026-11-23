import { useEffect, useState } from "react";

const requests = new Map();
export function useRemoteArtwork(kind, metadata, enabled = true) {
  const key = JSON.stringify([kind, metadata]);
  const [result, setResult] = useState({ key: null, artwork: null });
  useEffect(() => {
    if (!enabled || !metadata || !window.api.artwork?.[kind]) return;
    let active = true;
    let request = requests.get(key);
    if (!request) {
      request = window.api.artwork[kind](metadata).catch(() => null);
      requests.set(key, request);
      if (requests.size > 80) requests.delete(requests.keys().next().value);
    }
    request.then((artwork) => {
      if (active) setResult({ key, artwork });
    });
    return () => {
      active = false;
    };
  }, [key, enabled]);
  return enabled && result.key === key ? result.artwork : null;
}
