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
