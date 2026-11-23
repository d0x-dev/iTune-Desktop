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
