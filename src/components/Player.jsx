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
    }
    incoming.removeAttribute("src");
    incoming.load();
    incoming.dataset.trackId = trackId;
    setCurrentTime(0);
    setDuration(Number(currentTrack.durationSeconds) || 0);
    setError("");
    setLoading(true);
    try {
      const result = currentTrack.streamUrl
        ? { streamUrl: currentTrack.streamUrl }
        : await window.api.yt.getSongStream(trackId);
      if (revision !== requestId.current) return;
      if (!result?.streamUrl)
        throw new Error("This song couldn’t play. Press play to try again.");
      const resolvedDuration = Math.max(
        0,
        Number(result.metadata?.duration || currentTrack.durationSeconds) || 0,
      );
      incoming.dataset.durationSeconds = String(resolvedDuration);
      if (resolvedDuration) setDuration(resolvedDuration);
      incoming.src = result.streamUrl;
      const targetVolume = settings.current.muted ? 0 : settings.current.volume;
      incoming.volume = canCrossfade ? 0 : targetVolume;
      if (currentTrack.type !== "radio") {
        applyAudioEffects(incoming, preferences);
        await resumeAudioEffects(incoming);
      }
      if (desiredPlaying.current) {
        await incoming.play();
        if (revision !== requestId.current) {
          incoming.pause();
          return;
        }
        activeDeck.current = incomingIndex;
        setIsPlaying(true);
        if (canCrossfade) {
          fadeDecks(
            outgoing,
            incoming,
            Math.max(250, preferences.crossfadeDuration * 1000),
            targetVolume,
            revision,
          );
        }
      } else {
        activeDeck.current = incomingIndex;
        if (outgoing !== incoming) resetDeck(outgoing);
      }
      previousTrackType.current = currentTrack.type;
      crossfadeRequested.current = null;
    } catch (failure) {
      if (revision === requestId.current) {
        setIsPlaying(false);
        setError(
          failure.name === "NotAllowedError"
            ? "Press play to start listening."
            : "This song couldn’t play. Press play to try again.",
        );
      }
    } finally {
      if (revision === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTrack?.id) loadStream();
  }, [currentTrack?.id]);

  useEffect(
    () => () => {
      requestId.current++;
      stopFade();
      decks.current.forEach((audio) => audio?.pause());
    },
    [],
  );

  useEffect(() => {
    const resumePlayback = () => {
      if (document.visibilityState !== "visible" || !desiredPlaying.current) return;
      const audio = activeAudio();
      if (!audio?.getAttribute("src")) return;
      resumeAudioEffects(audio)
        .then(() => audio.play())
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", resumePlayback);
    window.addEventListener("focus", resumePlayback);
    return () => {
      document.removeEventListener("visibilitychange", resumePlayback);
      window.removeEventListener("focus", resumePlayback);
    };
  }, []);

  useEffect(() => {
    if (currentTrack?.type === "radio") return;
    decks.current.forEach((audio) => {
      if (audio?.getAttribute("src")) applyAudioEffects(audio, preferences);
    });
  }, [
    currentTrack?.id,
    currentTrack?.type,
    preferences.audioEffectsEnabled,
    preferences.audioPreset,
    preferences.virtualAtmos,
    preferences.spatialWidth,
    preferences.bassBoost,
    preferences.trebleBoost,
    preferences.reverbAmount,
    preferences.loudnessNormalization,
  ]);

  const togglePlay = () => {
    const audio = activeAudio();
    if (!currentTrack || !audio || loading) return;
    desiredPlaying.current = !isPlaying;
    onUserPlaybackAction?.(isPlaying ? "pause" : "play", {
      positionMs: Math.round((audio.currentTime || 0) * 1000),
    });
    if (isPlaying) {
      decks.current.forEach((deck) => deck?.pause());
    }
    else if (!audio.getAttribute("src") || audio.error) loadStream();
    else audio.play().catch(() => setError("Press play to try again."));
  };
  const seek = (seconds, notify = true) => {
    const audio = activeAudio();
    const knownDuration = Number.isFinite(audio?.duration) && audio.duration > 0
      ? audio.duration
      : Number(audio?.dataset.durationSeconds) || duration;
    if (!audio || !knownDuration) return;
    const time = Math.max(0, Math.min(seconds, knownDuration));
    audio.currentTime = time;
    setCurrentTime(time);
    if (notify)
      onUserPlaybackAction?.("seek", { positionMs: Math.round(time * 1000) });
  };
  const restart = () => {
    seek(0, false);
    activeAudio()?.play().catch(() => {});
  };
  useImperativeHandle(
    ref,
    () => ({
      togglePlay,
      seek: (seconds) => seek(seconds, false),
      restart,
      preparePlayback: (playing) => {
        desiredPlaying.current = Boolean(playing);
        if (!playing) decks.current.forEach((audio) => audio?.pause());
      },
      play: () => {
        desiredPlaying.current = true;
        const audio = activeAudio();
        if (!audio?.getAttribute("src") || audio.error) loadStream();
        else audio.play().catch(() => {});
      },
      pause: () => {
        desiredPlaying.current = false;
        decks.current.forEach((audio) => audio?.pause());
      },
      setVolume: (value) => changeVolume({ target: { value } }),
    }),
    [currentTrack, isPlaying, loading],
  );
  useEffect(() => {
    onPlaybackChange({ currentTime, duration, volume: muted ? 0 : volume });
  }, [currentTime, duration, volume, muted, onPlaybackChange]);

  useEffect(() => {
    const trackId = currentTrack?.id;
    if (
      !preferences.playbackHistorySync ||
      !trackId ||
      currentTrack?.type === "radio" ||
      currentTime < 15 ||
      reportedTracks.current.has(trackId)
    )
      return;
    reportedTracks.current.add(trackId);
    window.api.yt.reportPlayback(trackId, currentTime).then((result) => {
      if (result?.ok === false && !result?.skipped)
        reportedTracks.current.delete(trackId);
    });
  }, [currentTrack?.id, currentTrack?.type, currentTime, preferences.playbackHistorySync]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    if (!currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: getArtistName(currentTrack),
      album: currentTrack.album?.name || "iTune Desktop",
      artwork: [
        ...(currentTrack.thumbnail ? [{ src: currentTrack.thumbnail }] : []),
        { src: new URL("app-icon.png", document.baseURI).href, sizes: "512x512", type: "image/png" },
      ],
    });
    const actions = {
      play: () => {
        if (!isPlaying) togglePlay();
      },
      pause: () => {
        if (isPlaying) togglePlay();
      },
      previoustrack: onPrevious,
      nexttrack: () => onNext(),
      seekto: (event) => seek(event.seekTime),
      seekbackward: (event) =>
        seek((activeAudio()?.currentTime || 0) - (event.seekOffset || 10)),
      seekforward: (event) =>
        seek((activeAudio()?.currentTime || 0) + (event.seekOffset || 10)),
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    });
    return () =>
      Object.keys(actions).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      });
  }, [currentTrack, isPlaying, onPrevious, onNext]);

  const changeVolume = (event) => {
    const value = Number(event.target.value);
    setVolume(value);
    setMuted(value === 0);
    settings.current = { volume: value, muted: value === 0 };
    const audio = activeAudio();
    if (audio) audio.volume = value;
  };
  const toggleMute = () => {
    const nextMuted = !muted;
    const nextVolume = volume || 0.8;
    setMuted(nextMuted);
    setVolume(nextVolume);
    settings.current = { volume: nextVolume, muted: nextMuted };
    decks.current.forEach((audio) => {
      if (audio && !audio.paused)
        audio.volume = nextMuted ? 0 : nextVolume;
    });
  };

  const updateDeckTime = (index) => {
    if (activeDeck.current !== index) return;
    const audio = decks.current[index];
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
    const knownDuration =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : Number(audio.dataset.durationSeconds) ||
          Number(currentTrack?.durationSeconds) ||
          0;
    if (knownDuration) setDuration(knownDuration);
    const remaining = knownDuration - audio.currentTime;
    if (
      preferences.crossfadeEnabled &&
      preferences.autoplay &&
      repeatMode !== "one" &&
      currentTrack?.type !== "radio" &&
      Number.isFinite(remaining) &&
      remaining > 0 &&
      remaining <= preferences.crossfadeDuration &&
      audio.dataset.trackId === currentTrack?.id &&
      crossfadeRequested.current !== currentTrack.id
    ) {
      crossfadeRequested.current = currentTrack.id;
      Promise.resolve(onNext(false)).then((moved) => {
        if (
          moved === false &&
          crossfadeRequested.current === currentTrack.id
        ) {
          crossfadeRequested.current = null;
          if (audio.ended) {
            desiredPlaying.current = false;
            setIsPlaying(false);
          }
        }
      });
    }
  };

  const updateDeckDuration = (index) => {
    if (activeDeck.current !== index) return;
    const audio = decks.current[index];
    const knownDuration =
      Number.isFinite(audio?.duration) && audio.duration > 0
        ? audio.duration
        : Number(audio?.dataset.durationSeconds) ||
          Number(currentTrack?.durationSeconds) ||
          0;
    if (knownDuration) setDuration(knownDuration);
  };

  const handleDeckEnded = (index) => {
    const audio = decks.current[index];
    if (
      activeDeck.current !== index ||
      audio?.dataset.trackId !== currentTrack?.id
    )
      return;
    if (crossfadeRequested.current === currentTrack.id) return;
    if (repeatMode === "one") restart();
    else onNext(true);
  };

  return (
    <div className="player-bar" aria-label="Music player">
      {[0, 1].map((index) => (
        <audio
          key={`audio-deck-${index}`}
          ref={(node) => {
            decks.current[index] = node;
          }}
          preload="auto"
          onPlay={() => {
            if (activeDeck.current !== index) return;
            setIsPlaying(true);
            setError("");
          }}
          onPause={() => {
            if (activeDeck.current === index) setIsPlaying(false);
          }}
          onTimeUpdate={() => updateDeckTime(index)}
          onLoadedMetadata={() => updateDeckDuration(index)}
          onDurationChange={() => updateDeckDuration(index)}
          onWaiting={() => {
            if (activeDeck.current === index) setLoading(true);
          }}
          onPlaying={() => {
            if (activeDeck.current === index) setLoading(false);
          }}
          onError={() => {
            const audio = decks.current[index];
            if (
              activeDeck.current === index &&
              audio?.getAttribute("src")
            ) {
              setLoading(false);
              setIsPlaying(false);
              setError("This song couldn’t play. Press play to try again.");
            }
          }}
          onEnded={() => handleDeckEnded(index)}
