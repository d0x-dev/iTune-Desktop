import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  X,
  Minimize2,
  Maximize2,
  Upload,
  Play,
  Pause,
  Loader2,
  Music2,
  LocateFixed,
  Volume2,
  Languages,
  MoreHorizontal,
  Search,
  Pencil,
  SlidersHorizontal,
  RefreshCw,
  ArrowLeft,
  Check,
  RotateCcw,
  FileText,
} from "lucide-react";
import Artwork from "./Artwork";
import AndroidIcon from "./AndroidIcon";
import Canvas from "./Canvas";
import LyricLine from "./LyricLine";
import AnimatedPresence from "./AnimatedPresence";
import { getArtistName, formatTime } from "../utils/format";
import { activeLyricIndex, parseLyrics } from "../utils/lyrics";
import {
  artistAssetId,
  readAsset,
  saveAsset,
  useMediaAsset,
} from "../utils/mediaAssets";
import { highQualityArtwork } from "../../shared/artwork.mjs";
import { usePreferences } from "../utils/preferences";
import { animateLyricScroll, lyricScrollLead } from "../utils/lyricMotion";

const MANUAL_SCROLL_TIMEOUT_MS = 3000;
const HOLD_PAST_END = { holdPastEnd: true };
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export default function LyricsModal({
  track,
  onClose,
  playback,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  compact = false,
  onToggleCompact,
  canvasUrl,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  onVolumeChange,
}) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(true);
  const [reload, setReload] = useState(0);
  const [source, setSource] = useState("");
  const [rawLyrics, setRawLyrics] = useState("");
  const [translations, setTranslations] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [toolsPage, setToolsPage] = useState(null);
  const [searchTitle, setSearchTitle] = useState(track.title || "");
  const [searchArtist, setSearchArtist] = useState(getArtistName(track));
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const { preferences, updatePreference } = usePreferences();
  const dialog = useRef(null);
  const scroll = useRef(null);
  const fileInput = useRef(null);
  const revision = useRef(0);
  const idleTimer = useRef(null);
  const scrollMotion = useRef(null);
  const placedLyrics = useRef(null);
  const manualScrollTimer = useRef(null);
  const scrollLead = useRef(0);
  const pointerActive = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const artistId = artistAssetId(track);
  const canvas = useMediaAsset(artistId ? `artist:${artistId}:canvas` : null);
  const signature = useMediaAsset(
    artistId ? `artist:${artistId}:signature` : null,
  );
  const lyricsTime = Math.max(0, playback.currentTime + lyricsOffsetMs / 1000);
  const lyricsDuration = Math.round(
    playback.duration || track.durationSeconds || 0,
  );
  const activeIndex = activeLyricIndex(lines, lyricsTime);
  const timed = lines.some((line) => line.start != null);
  const lastStartedIndex = activeLyricIndex(lines, lyricsTime, HOLD_PAST_END);
  scrollLead.current = lyricScrollLead(lines, lastStartedIndex);
  const focusIndex = isPlaying
    ? activeLyricIndex(lines, lyricsTime + scrollLead.current / 1000, HOLD_PAST_END)
    : lastStartedIndex;

  const scheduleControlsHide = useCallback(() => {
    clearTimeout(idleTimer.current);
    setControlsVisible(true);
    if (!compact || toolsPage || pointerActive.current) return;
    idleTimer.current = setTimeout(() => {
      if (!pointerActive.current) setControlsVisible(false);
    }, 2000);
  }, [compact, toolsPage]);

  useEffect(() => {
    scheduleControlsHide();
    return () => clearTimeout(idleTimer.current);
  }, [scheduleControlsHide, track.id]);

  useEffect(() => {
    if (toolsPage || !compact) {
      clearTimeout(idleTimer.current);
      setControlsVisible(true);
    }
  }, [compact, toolsPage]);

  useEffect(() => {
    const saved = Number(localStorage.getItem(`itune:lyrics-offset:${track.id}`));
    setLyricsOffsetMs(Number.isFinite(saved) ? Math.max(-5000, Math.min(5000, saved)) : 0);
    setSearchTitle(track.title || "");
    setSearchArtist(getArtistName(track));
    setSearchResults([]);
    setToolsPage(null);
  }, [track.id]);

  useEffect(() => {
    let active = true;
    const requestRevision = ++revision.current;
    setLines([]);
    setLoading(true);
    setError("");
    setSource("");
    setFollowing(true);
    async function load() {
      try {
        const imported = await readAsset(`lyrics:${track.id}`);
        const result = imported
          ? {
              lyrics: await imported.text(),
              source:
                localStorage.getItem(`itune:lyrics-source:${track.id}`) ||
                "Custom lyrics",
            }
          : await window.api.yt.getLyrics(track.id, {
              title: track.title,
              artist: getArtistName(track),
              // Prefer the decoded audio duration. YouTube music videos often
              // include long visual intros/outros that make lyric matching late.
              duration: lyricsDuration,
              provider: preferences.lyricsProvider,
            });
        if (!active || revision.current !== requestRevision) return;
        setRawLyrics(result?.lyrics || "");
        setLines(parseLyrics(result?.lyrics));
        setSource(result?.source || "");
      } catch {
        if (active && revision.current === requestRevision)
          setError("Lyrics couldn’t load. You can import a lyrics file.");
      } finally {
        if (active && revision.current === requestRevision) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [track.id, reload, preferences.lyricsProvider, lyricsDuration]);

  useEffect(() => {
    let active = true;
    setTranslations([]);
    setTranslationError("");
    if (!preferences.lyricsTranslation || !lines.length) return;
    setTranslating(true);
    window.api.yt
      .translateLyrics(
        lines.map((line) => line.text || ""),
        preferences.translationLanguage,
        preferences.translationMode,
      )
      .then((result) => {
        if (!active) return;
        if (!result?.ok) throw new Error(result?.error);
        setTranslations(result.translations || []);
      })
      .catch(() => {
        if (active) setTranslationError("Lyrics translation is unavailable.");
      })
      .finally(() => {
        if (active) setTranslating(false);
      });
    return () => {
      active = false;
    };
  }, [
    lines,
    preferences.lyricsTranslation,
    preferences.translationLanguage,
    preferences.translationMode,
  ]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab" || compact) return;
      const elements = [
        ...dialog.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]):not([type="file"]), .lyrics-scroll',
        ),
      ];
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    const element = dialog.current;
    element?.addEventListener("keydown", onKey);
    return () => {
      element?.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [compact]);
  useLayoutEffect(() => {
    if (!following || loading || focusIndex < 0) return;
    const element = scroll.current;
    const line = element?.querySelector(`[data-line="${focusIndex}"]`);
    if (!line) return;
    const previous = placedLyrics.current;
    const initial = previous?.lines !== lines || previous?.trackId !== track.id;
    const modeChanged = previous?.compact !== compact;
    const layoutChanged = modeChanged ||
      (compact && previous?.controlsVisible !== controlsVisible);
    placedLyrics.current = { lines, trackId: track.id, compact, controlsVisible };
    const cancel = animateLyricScroll(element, line, {
      duration: layoutChanged ? 560 : scrollLead.current,
      immediate: initial || modeChanged,
      stagger: !layoutChanged,
    });
    scrollMotion.current = cancel;
    return () => {
      cancel();
      if (scrollMotion.current === cancel) scrollMotion.current = null;
    };
  }, [focusIndex, following, loading, lines, track.id, compact, controlsVisible, translations]);

  useEffect(() => () => clearTimeout(manualScrollTimer.current), [lines, track.id]);

  const resumeFollowing = () => {
    clearTimeout(manualScrollTimer.current);
    setFollowing(true);
  };

  const browseLyrics = () => {
    if (!timed) return;
    scrollMotion.current?.();
    setFollowing(false);
    clearTimeout(manualScrollTimer.current);
    manualScrollTimer.current = setTimeout(resumeFollowing, MANUAL_SCROLL_TIMEOUT_MS);
  };

  const importLyrics = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const requestRevision = ++revision.current;
    const id = track.id;
    try {
      const text = await file.text();
      const parsed = parseLyrics(text);
      if (!parsed.length) throw new Error("This file has no lyrics.");
      await saveAsset(`lyrics:${id}`, file);
      localStorage.setItem(`itune:lyrics-source:${id}`, "Imported lyrics");
      if (revision.current !== requestRevision) return;
      setLines(parsed);
      setRawLyrics(text);
      setSource("Imported lyrics");
      setError("");
      setFollowing(true);
      setToolsPage(null);
    } catch (failure) {
      if (revision.current === requestRevision) setError(failure.message);
    } finally {
      if (revision.current === requestRevision) setLoading(false);
    }
  };
  const applyLyrics = async (text, nextSource) => {
    const parsed = parseLyrics(text);
    if (!parsed.length) throw new Error("These lyrics have no readable lines.");
    await saveAsset(
      `lyrics:${track.id}`,
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    localStorage.setItem(`itune:lyrics-source:${track.id}`, nextSource);
    setRawLyrics(text);
    setLines(parsed);
    setSource(nextSource);
    setError("");
    setFollowing(true);
    setToolsPage(null);
  };
  const restoreOnlineLyrics = async () => {
    await saveAsset(`lyrics:${track.id}`, null);
    localStorage.removeItem(`itune:lyrics-source:${track.id}`);
    setToolsPage(null);
    setReload((value) => value + 1);
  };
  const searchLyrics = async (event) => {
    event?.preventDefault();
    setSearching(true);
    setSearchError("");
    try {
      const result = await window.api.yt.searchLyrics(track.id, {
        title: searchTitle.trim(),
        artist: searchArtist.trim(),
        duration: lyricsDuration,
      });
      setSearchResults(result?.results || []);
      if (!result?.results?.length)
        setSearchError("No matching lyrics found. Try changing the title or artist.");
    } catch {
      setSearchResults([]);
      setSearchError("Lyrics search couldn’t be completed.");
    } finally {
      setSearching(false);
    }
  };
  const openToolsPage = (page) => {
    if (page === "edit") setLyricsDraft(rawLyrics);
    if (page === "search" && !searchResults.length) queueMicrotask(searchLyrics);
    setToolsPage(page);
  };
  const updateLyricsOffset = (value) => {
    const offset = Math.max(-5000, Math.min(5000, Math.round(Number(value) / 100) * 100));
    setLyricsOffsetMs(offset);
    localStorage.setItem(`itune:lyrics-offset:${track.id}`, String(offset));
  };
  const offsetLabel = `${lyricsOffsetMs >= 0 ? "+" : ""}${(lyricsOffsetMs / 1000).toFixed(1)}s`;
  const lineStyle = (index) => {
    const distance = Math.abs(index - Math.max(0, activeIndex));
    return {
      "--lyric-opacity": !timed
        ? 0.95
        : index === activeIndex
          ? 1
          : !following
            ? 0.8
            : [1, 0.72, 0.56, 0.44, 0.34, 0.26][Math.min(distance, 5)],
      "--lyric-blur": `${!timed || !following || index === activeIndex ? 0 : [0, 1.1, 1.8, 2.6, 3.4][Math.min(distance, 4)]}px`,
    };
  };
  const video = track.canvasUrl || canvasUrl || canvas;
  return (
    <div
      className={`lyrics-overlay ${compact ? "compact-lyrics" : ""} ${compact && !controlsVisible ? "lyrics-controls-hidden" : ""}`}
      onPointerMove={scheduleControlsHide}
      onPointerDown={() => {
        pointerActive.current = true;
        clearTimeout(idleTimer.current);
        setControlsVisible(true);
      }}
      onPointerUp={() => {
        pointerActive.current = false;
        scheduleControlsHide();
      }}
      onPointerCancel={() => {
        pointerActive.current = false;
        scheduleControlsHide();
      }}
      onWheel={scheduleControlsHide}
      onTouchStart={scheduleControlsHide}
      onClick={(event) => {
        scheduleControlsHide();
        if (!compact && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="lyrics-dialog"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal={!compact}
        aria-label={`Lyrics for ${track.title}`}
      >
        <div className="lyrics-ambient" aria-hidden="true">
          {track.thumbnail && (
            <img src={highQualityArtwork(track.thumbnail)} alt="" />
          )}
          <Canvas src={video} paused={!isPlaying} />
        </div>
        <div className="lyrics-topline">
          <span>Lyrics{source && <small> · {source}</small>}</span>
          <div>
            <button
              className={`icon-button ${toolsPage ? "selected" : ""}`}
              aria-label="Lyrics options"
              title="Search, choose, edit, or synchronize lyrics"
              onClick={() => setToolsPage((page) => (page ? null : "menu"))}
            >
              <MoreHorizontal size={19} />
            </button>
            <button
              className={`icon-button ${preferences.lyricsTranslation ? "selected" : ""}`}
              aria-label="Translate lyrics"
              title="Translate every lyric line"
              onClick={() =>
                updatePreference(
                  "lyricsTranslation",
                  !preferences.lyricsTranslation,
                )
              }
            >
              {translating ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Languages size={18} />
              )}
            </button>
            <button
              className="icon-button"
              aria-label={compact ? "Expand lyrics" : "Compact lyrics popup"}
              onClick={onToggleCompact}
            >
              {compact ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Close lyrics"
              onClick={onClose}
            >
              <X size={21} />
            </button>
          </div>
        </div>
        <input
          type="file"
          ref={fileInput}
          hidden
          accept=".ttml,.xml,.lrc,.txt"
          onChange={importLyrics}
        />
        <AnimatedPresence
          show={Boolean(toolsPage)}
          duration={220}
          className="presence-lyrics-tools"
        >
          <div
            className="lyrics-tools-scrim"
            onClick={() => setToolsPage(null)}
          >
            <div
              className="lyrics-tools-popover"
              role="dialog"
              aria-label="Lyrics options"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="lyrics-tools-header">
                {toolsPage !== "menu" && (
                  <button
                    className="icon-button"
                    aria-label="Back to lyrics options"
                    onClick={() => setToolsPage("menu")}
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <strong>
                    {toolsPage === "menu"
                      ? "Lyrics"
                      : toolsPage === "search"
                        ? "Search Lyrics"
                        : toolsPage === "edit"
                          ? "Edit Lyrics"
                          : "Lyrics Offset"}
                  </strong>
                  <small>
                    {toolsPage === "offset"
                      ? offsetLabel
                      : source || "No source selected"}
                  </small>
                </div>
                <button
                  className="icon-button lyrics-tools-close"
                  aria-label="Close lyrics options"
                  onClick={() => setToolsPage(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {toolsPage === "menu" && (
                <div className="lyrics-tools-menu">
                  <button onClick={() => openToolsPage("search")}>
                    <Search size={19} />
                    <span><strong>Search & choose</strong><small>Compare all online providers</small></span>
                    <em>Online</em>
                  </button>
                  <button onClick={() => openToolsPage("edit")}>
                    <Pencil size={19} />
                    <span><strong>Edit lyrics</strong><small>Plain text, LRC, or TTML</small></span>
                    {source.includes("Edited") && <em>Edited</em>}
                  </button>
                  <button onClick={() => openToolsPage("offset")}>
                    <SlidersHorizontal size={19} />
                    <span><strong>Lyrics offset</strong><small>Correct early or late timing</small></span>
                    <em>{offsetLabel}</em>
                  </button>
                  <button onClick={() => fileInput.current?.click()}>
                    <Upload size={19} />
                    <span><strong>Import lyrics</strong><small>TTML, XML, LRC, or text</small></span>
                  </button>
                  <button onClick={restoreOnlineLyrics}>
                    <RefreshCw size={19} />
                    <span><strong>Reload online lyrics</strong><small>Remove a custom selection or edit</small></span>
                  </button>
                </div>
              )}

              {toolsPage === "search" && (
                <form className="lyrics-search-tools" onSubmit={searchLyrics}>
                  <label>
                    <span>Song Name</span>
                    <input
                      value={searchTitle}
                      onChange={(event) => setSearchTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Artist Name</span>
                    <input
                      value={searchArtist}
                      onChange={(event) => setSearchArtist(event.target.value)}
                    />
                  </label>
                  <button className="lyrics-primary-action" disabled={searching}>
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {searching ? "Searching all providers…" : "Search"}
                  </button>
                  <div className="lyrics-search-results no-scrollbar">
                    {searchError && <p className="lyrics-tools-message">{searchError}</p>}
                    {searchResults.map((item) => (
                      <button
                        type="button"
                        className="lyrics-search-result"
                        key={`${item.provider}-${item.source}`}
                        onClick={async () => {
                          try {
                            await applyLyrics(item.lyrics, `${item.source} · Selected`);
                          } catch (failure) {
                            setSearchError(failure.message);
                          }
                        }}
                      >
                        <span>
                          <strong>{item.trackName || track.title}</strong>
                          <small>{item.artistName || getArtistName(track)} · {item.source}</small>
                          {item.preview && <small>{item.preview}</small>}
                        </span>
                        <em className={item.synced ? "synced" : ""}>
                          {item.synced ? "SYNCED" : "PLAIN"}
                        </em>
                      </button>
                    ))}
                  </div>
                </form>
              )}

              {toolsPage === "edit" && (
                <div className="lyrics-edit-tools">
                  <textarea
                    value={lyricsDraft}
                    onChange={(event) => setLyricsDraft(event.target.value)}
                    placeholder="Write or paste lyrics here. Supports plain text, [mm:ss.xx] LRC, and TTML."
                    spellCheck="false"
                  />
                  <div>
                    <button onClick={() => setLyricsDraft("")}>
                      <FileText size={15} /> Clear
                    </button>
                    <button onClick={restoreOnlineLyrics}>
                      <RotateCcw size={15} /> Reset
                    </button>
                    <button
                      className="lyrics-primary-action"
                      onClick={async () => {
                        try {
                          await applyLyrics(lyricsDraft, "Edited lyrics");
                        } catch (failure) {
                          setError(failure.message);
                        }
                      }}
                    >
                      <Check size={16} /> Save
                    </button>
                  </div>
                </div>
              )}

              {toolsPage === "offset" && (
                <div className="lyrics-offset-tools">
                  <strong>{offsetLabel}</strong>
                  <p>Move forward when lyrics appear late, backward when they appear early. Audio is unchanged.</p>
                  <input
                    className="apple-seekbar lyrics-offset-seekbar"
                    type="range"
                    min="-5000"
                    max="5000"
                    step="100"
                    value={lyricsOffsetMs}
                    onChange={(event) => updateLyricsOffset(event.target.value)}
                    style={{ "--progress": `${(lyricsOffsetMs + 5000) / 100}%` }}
                  />
                  <div className="lyrics-offset-scale"><span>−5.0s</span><span>0</span><span>+5.0s</span></div>
                  <div className="lyrics-offset-actions">
                    <button onClick={() => updateLyricsOffset(lyricsOffsetMs - 500)}>−0.5s</button>
                    <button onClick={() => updateLyricsOffset(0)}>Reset</button>
                    <button onClick={() => updateLyricsOffset(lyricsOffsetMs + 500)}>+0.5s</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AnimatedPresence>
        <div className="lyrics-layout">
          <div className="lyrics-track-panel">
            <div className={`lyrics-cover ${isPlaying ? "playing" : ""}`}>
              <Artwork src={track.thumbnail} title={track.title} eager />
              <Canvas src={video} paused={!isPlaying} />
            </div>
            <div className="lyrics-track-info">
              <h2>{track.title}</h2>
              <p>{getArtistName(track)}</p>
              {signature && (
                <img
                  className="lyrics-signature"
                  src={signature}
                  alt={`${getArtistName(track)} signature artwork`}
                />
              )}
            </div>
            <div className="lyrics-player">
              <div className="lyrics-timeline">
                <input
                  className="apple-seekbar"
                  aria-label="Lyrics playback position"
                  type="range"
                  min="0"
                  max={playback.duration || 1}
                  step="0.1"
                  value={Math.min(playback.currentTime, playback.duration || 1)}
                  disabled={!playback.duration}
                  onChange={(event) => onSeek(Number(event.target.value))}
                  style={{
                    "--progress": `${playback.duration ? (playback.currentTime / playback.duration) * 100 : 0}%`,
                  }}
                />
                <div>
                  <span>{formatTime(playback.currentTime)}</span>
                  <span>
                    −
                    {formatTime(
                      Math.max(0, playback.duration - playback.currentTime),
                    )}
                  </span>
                </div>
              </div>
              <div className="lyrics-transport">
                <button
                  className={`icon-button ${isShuffle ? "selected" : ""}`}
                  aria-label="Lyrics shuffle"
                  aria-pressed={isShuffle}
                  onClick={onToggleShuffle}
                >
                  <AndroidIcon name="shuffle" size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Previous song"
                  onClick={onPrevious}
                >
                  <AndroidIcon name="skip_previous" size={25} />
                </button>
                <button
                  className="transport-play icon-button"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  onClick={onTogglePlay}
                >
                  {isPlaying ? (
                    <Pause size={35} fill="currentColor" />
                  ) : (
                    <Play size={35} fill="currentColor" />
                  )}
                </button>
                <button
                  className="icon-button"
                  aria-label="Next song"
                  onClick={() => onNext()}
                >
                  <AndroidIcon name="skip_next" size={25} />
                </button>
                <button
                  className={`icon-button ${repeatMode !== "off" ? "selected" : ""}`}
                  aria-label={`Lyrics repeat ${repeatMode}`}
                  onClick={onToggleRepeat}
                >
                  <AndroidIcon
                    name={repeatMode === "one" ? "repeat_one" : "repeat"}
                    size={17}
                  />
