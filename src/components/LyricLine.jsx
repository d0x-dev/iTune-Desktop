import React, { useEffect, useRef } from "react";

/* Word lift, glow, and progressive fill ported from iTune Android LyricsV2Screen.
 * DxV Studio / Dark. Credits DxV Studio, AirBeats, Dark. GPL-3.0.
 */
export default function LyricLine({ line, currentTime, active, isPlaying }) {
  const element = useRef(null);
  const clock = useRef({
    time: currentTime,
    at: performance.now(),
    playing: isPlaying,
  });
  clock.current = {
    time: currentTime,
    at: performance.now(),
    playing: isPlaying,
  };
  useEffect(() => {
    if (!active || !line.words?.some((word) => word.start != null)) return;
    let frame;
    const words = [...element.current.querySelectorAll("[data-word-start]")];
    const update = () => {
      const time =
        clock.current.time +
        (clock.current.playing
          ? (performance.now() - clock.current.at) / 1000
          : 0);
      for (const word of words) {
        const start = Number(word.dataset.wordStart);
        const end = Number(word.dataset.wordEnd);
        const progress = Math.max(
          0,
          Math.min(1, (time - start) / Math.max(0.05, end - start)),
        );
