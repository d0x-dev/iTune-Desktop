/* Scroll handover from iTune Android LyricsV2Screen, DxV Studio / Dark, GPL-3.0. */
const MIN_LEAD_MS = 350;
const MAX_LEAD_MS = 500;
const STAGGER_FRACTION = 0.06;
const STAGGER_STEPS = 3;

export function lyricScrollLead(lines, activeIndex) {
  const current = lines[activeIndex];
  const next = lines[activeIndex + 1];
  if (!current || next?.start == null) return MIN_LEAD_MS;
  const lastWord = current.words?.findLast((word) => word.end != null);
  const end = lastWord?.end ?? current.end ?? current.start;
  const gap = next.start - end;
  const lead = gap > 0 ? gap : (next.start - current.start) * 0.14;
  return Math.max(MIN_LEAD_MS, Math.min(MAX_LEAD_MS, lead * 1000));
}

function lyricEase(progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let low = 0;
  let high = 1;
  let parameter = progress;
  for (let index = 0; index < 12; index++) {
    const inverse = 1 - parameter;
    const x =
      3 * inverse * inverse * parameter * 0.41 +
      3 * inverse * parameter * parameter * 0.12 +
      parameter ** 3;
    if (x < progress) low = parameter;
    else high = parameter;
    parameter = (low + high) / 2;
  }
  return 3 * (1 - parameter) * parameter * parameter * 0.99 + parameter ** 3;
}

export function animateLyricScroll(element, line, { duration, immediate, stagger }) {
  const start = element.scrollTop;
  const resolveTarget = () => {
    const offset = line.offsetTop - element.clientHeight * 0.4;
    return Math.max(0, Math.min(offset, element.scrollHeight - element.clientHeight));
  };
  if (immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.scrollTop = resolveTarget();
    return () => {};
  }

  const direction = Math.sign(resolveTarget() - start);
  const rows = [];
  if (stagger && direction) {
    let row = direction > 0 ? line.nextElementSibling : line.previousElementSibling;
    while (row && Math.abs(row.offsetTop - start) < element.clientHeight * 2) {
      rows.push(row);
      row = direction > 0 ? row.nextElementSibling : row.previousElementSibling;
    }
  }

  const delays = Array.from({ length: STAGGER_STEPS }, (_, index) =>
    (index + 1) * STAGGER_FRACTION * duration,
  );
  const total = duration + (rows.length ? delays.at(-1) : 0);
  const began = performance.now();
  let frame;
  const clearRows = () => {
    for (const row of rows) row.style.removeProperty("--lyric-scroll-offset");
  };
  const update = (now) => {
    const elapsed = now - began;
    const distance = resolveTarget() - start;
    const progress = lyricEase(elapsed / duration);
    // Cancel part of the list movement on trailing rows so they catch up in sequence.
    for (const [index, row] of rows.entries()) {
      const delay = delays[Math.min(index, STAGGER_STEPS - 1)];
      const delayed = lyricEase((elapsed - delay) / duration);
      const offset = distance * (progress - delayed);
      row.style.setProperty("--lyric-scroll-offset", `${offset}px`);
    }
    element.scrollTop = start + distance * progress;
    if (elapsed < total) frame = requestAnimationFrame(update);
    else clearRows();
  };
  frame = requestAnimationFrame(update);
  return () => {
    cancelAnimationFrame(frame);
    clearRows();
  };
}
