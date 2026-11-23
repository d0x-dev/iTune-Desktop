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
