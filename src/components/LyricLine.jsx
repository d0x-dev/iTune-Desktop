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
        const lift = Math.sin(progress * Math.PI);
        word.style.setProperty("--word-progress", `${progress * 100}%`);
        word.style.setProperty("--word-float", `${-4 * lift}px`);
        word.style.setProperty("--word-scale", String(1 + 0.015 * lift));
        word.style.setProperty(
          "--word-glow",
          `${progress > 0 && progress < 1 ? Math.min(1, progress * 2) * 12 : 0}px`,
        );
      }
      if (clock.current.playing) frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [active, line.words, isPlaying]);
  if (!line.words?.length) return line.text;
  return (
    <span ref={element}>
      {line.words.map((word, index) =>
        word.start == null ? (
          <span key={index}>{word.text}</span>
        ) : (
          <span
            key={index}
            className="lyric-word"
            data-text={word.text}
            data-word-start={word.start}
            data-word-end={word.end ?? line.end ?? word.start + 1}
          >
            {word.text}
          </span>
        ),
      )}
    </span>
  );
}
