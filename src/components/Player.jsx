import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  MessageSquareText,
  Loader2,
  ListMusic,
  Music2,
  SlidersHorizontal,
} from "lucide-react";
import Artwork from "./Artwork";
import AndroidIcon from "./AndroidIcon";
import FavoriteIcon from "./FavoriteIcon";
import ExplicitTitle from "./ExplicitTitle";
import { getArtistName, formatTime } from "../utils/format";
import { usePreferences } from "../utils/preferences";
import AudioEffectsPanel from "./AudioEffectsPanel";
import AnimatedPresence from "./AnimatedPresence";
import { applyAudioEffects, resumeAudioEffects } from "../utils/audioEngine";

const Player = forwardRef(function Player(
  {
    currentTrack,
    isPlaying,
    setIsPlaying,
    onNext,
    onPrevious,
    onOpenLyrics,
    isLiked,
    onToggleLike,
    isShuffle,
    onToggleShuffle,
    repeatMode,
    onToggleRepeat,
    endlessQueueEnabled,
    onToggleEndlessQueue,
    onToggleQueue,
    showQueue,
    showLyrics,
    showListenTogether,
    listenTogetherActive,
    onToggleListenTogether,
    onPlaybackChange,
    onUserPlaybackAction,
  },
  ref,
) {
  const decks = useRef([null, null]);
  const activeDeck = useRef(0);
  const previousTrackType = useRef(null);
  const fadeFrame = useRef(null);
  const fadeState = useRef(null);
  const crossfadeRequested = useRef(null);
  const requestId = useRef(0);
  const reportedTracks = useRef(new Set());
  const desiredPlaying = useRef(true);
  const { preferences } = usePreferences();
  const settings = useRef({ volume: 0.8, muted: false });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
