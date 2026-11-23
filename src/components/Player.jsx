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
  const [showEffects, setShowEffects] = useState(false);

  const activeAudio = () => decks.current[activeDeck.current];

  const resetDeck = (audio) => {
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {}
    audio.removeAttribute("src");
    delete audio.dataset.trackId;
    delete audio.dataset.durationSeconds;
    audio.load();
  };

  const stopFade = () => {
    if (fadeFrame.current) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
    const interrupted = fadeState.current;
    fadeState.current = null;
    if (interrupted?.outgoing && interrupted.outgoing !== activeAudio())
      resetDeck(interrupted.outgoing);
  };

  const fadeDecks = (outgoing, incoming, milliseconds, targetVolume, revision) => {
    stopFade();
    fadeState.current = { outgoing, incoming };
    const startedAt = performance.now();
    const step = (now) => {
      if (revision !== requestId.current) {
        resetDeck(outgoing);
        fadeState.current = null;
        fadeFrame.current = null;
        return;
      }
      const progress = Math.min(1, (now - startedAt) / milliseconds);
      const liveTarget = settings.current.muted
        ? 0
        : settings.current.volume || targetVolume;
      incoming.volume = liveTarget * Math.sin((progress * Math.PI) / 2);
      outgoing.volume = liveTarget * Math.cos((progress * Math.PI) / 2);
      if (progress < 1) {
        fadeFrame.current = requestAnimationFrame(step);
      } else {
        resetDeck(outgoing);
        incoming.volume = liveTarget;
        fadeState.current = null;
        fadeFrame.current = null;
      }
    };
    fadeFrame.current = requestAnimationFrame(step);
  };

  const loadStream = async () => {
    const trackId = currentTrack?.id;
    const revision = ++requestId.current;
    const outgoingIndex = activeDeck.current;
    const outgoing = decks.current[outgoingIndex];
    if (!outgoing || !trackId) return;
    stopFade();
    const canCrossfade = Boolean(
      preferences.crossfadeEnabled &&
        currentTrack.type !== "radio" &&
        previousTrackType.current !== "radio" &&
        outgoing.getAttribute("src") &&
        !outgoing.paused &&
        !outgoing.ended,
    );
    const incomingIndex = canCrossfade ? 1 - outgoingIndex : outgoingIndex;
    const incoming = decks.current[incomingIndex];
    if (!incoming) return;
    if (incoming !== outgoing) resetDeck(incoming);
    if (!canCrossfade) {
      decks.current.forEach((deck, index) => {
        if (deck && index !== incomingIndex) resetDeck(deck);
      });
      outgoing.pause();
