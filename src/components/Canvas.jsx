import React, { useEffect, useRef, useState } from "react";
import { usePreferences } from "../utils/preferences";

export default function Canvas({ src, className = "", paused = false }) {
  const video = useRef(null);
  const [failedSrc, setFailedSrc] = useState(null);
  const { preferences } = usePreferences();
  useEffect(() => {
    const media = video.current;
    if (!media || !src || !preferences.motion) return;
    if (
      /\.m3u8(?:\?|$)/i.test(src) &&
      !media.canPlayType("application/vnd.apple.mpegurl")
    ) {
      let disposed = false;
      let hls;
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setFailedSrc(src);
            return;
          }
          hls = new Hls({
            maxBufferLength: 12,
            maxMaxBufferLength: 24,
            capLevelToPlayerSize: true,
            startLevel: -1,
          });
          hls.loadSource(src);
          hls.attachMedia(media);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setFailedSrc(src);
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (
              !paused &&
              !document.hidden &&
              !matchMedia("(prefers-reduced-motion: reduce)").matches
            )
              media.play().catch(() => {});
          });
        })
        .catch(() => {
          if (!disposed) setFailedSrc(src);
        });
      return () => {
        disposed = true;
        hls?.destroy();
      };
    }
    media.src = src;
    return () => {
      media.removeAttribute("src");
      media.load();
    };
  }, [src, preferences.motion]);
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (paused || !preferences.motion || motion.matches || document.hidden)
        media.pause();
      else media.play().catch(() => {});
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.pause();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [src, paused, preferences.motion]);
  if (!src || failedSrc === src || !preferences.motion) return null;
  return (
    <video
      ref={video}
      className={`canvas-video ${className}`}
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      onError={() => setFailedSrc(src)}
    />
  );
}
