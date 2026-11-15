import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  FileText,
  Loader2,
  Heart,
} from 'lucide-react';
import { getArtistName, formatTime } from '../utils/format';

export default function Player({
  currentTrack,
  isPlaying,
  setIsPlaying,
  onNext,
  onPrevious,
  onOpenLyrics,
  isLiked = false,
  onToggleLike,
}) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'

  const isSeekingRef = useRef(false);
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const lastLoadedTrackIdRef = useRef(null);

  // Function to load and play stream
  const loadTrackStream = (trackId) => {
    if (!trackId) return;
    setIsLoadingStream(true);
    setCurrentTime(0);
    setDuration(currentTrack?.durationSeconds || 0);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }

    window.api.yt
      ?.getSongStream(trackId)
      .then((res) => {
        if (res?.streamUrl && audio) {
          audio.src = res.streamUrl;
          audio.volume = isMuted ? 0 : volume;
          audio
            .play()
            .then(() => {
              setIsPlaying(true);
              setIsLoadingStream(false);
            })
            .catch((playErr) => {
              console.warn('Playback autoplay hindered or interrupted:', playErr.message);
              setIsLoadingStream(false);
              setIsPlaying(false);
            });
        } else {
          console.error('Failed to get stream URL:', res?.error);
          setIsLoadingStream(false);
        }
      })
      .catch((err) => {
        console.error('Error in getSongStream:', err);
        setIsLoadingStream(false);
      });
  };

  // Load new track stream whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack?.id) return;
    if (lastLoadedTrackIdRef.current === currentTrack.id) return;
    lastLoadedTrackIdRef.current = currentTrack.id;

    loadTrackStream(currentTrack.id);
  }, [currentTrack?.id]);

  // Sync OS MediaSession API for Windows media controls / keys
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || 'Unknown Title',
          artist: getArtistName(currentTrack) || 'YouTube Music',
          artwork: currentTrack.thumbnail
            ? [{ src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
            : [],
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (onPrevious) onPrevious();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (onNext) onNext();
        });
      } catch (e) {}
    }
  }, [currentTrack?.id, currentTrack?.title]);

  // Handle Play/Pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio.src || audio.error) {
        lastLoadedTrackIdRef.current = null;
        loadTrackStream(currentTrack.id);
        return;
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('Audio play retry:', e.message);
          lastLoadedTrackIdRef.current = null;
          loadTrackStream(currentTrack.id);
        });
    }
  };

  const handleSeekChange = (e) => {
    isSeekingRef.current = true;
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekCommit = (e) => {
    const newTime = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
    }
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (isMuted) {
      const v = volume || 0.8;
      setIsMuted(false);
      if (audio) audio.volume = v;
    } else {
      setIsMuted(true);
      if (audio) audio.volume = 0;
    }
  };

  return (
    <footer className="player-bar">
      {/* Native HTML5 Audio Element */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setIsPlaying(true);
          setIsLoadingStream(false);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio && !isSeekingRef.current) {
            setCurrentTime(audio.currentTime);
          }
        }}
        onDurationChange={() => {
          const audio = audioRef.current;
          if (audio && audio.duration && Number.isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onWaiting={() => setIsLoadingStream(true)}
        onPlaying={() => setIsLoadingStream(false)}
        onError={(e) => {
          const err = audioRef.current?.error;
          console.error('Audio element error:', err ? `Code ${err.code}: ${err.message}` : e);
          setIsLoadingStream(false);
          setIsPlaying(false);
        }}
        onEnded={() => {
          if (repeatModeRef.current === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          } else if (onNext) {
            onNext();
          }
        }}
      />

      {/* Left: Track Info */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[200px]">
        {currentTrack ? (
          <>
            <div className="relative group w-14 h-14 rounded-xl overflow-hidden shadow-md bg-neutral-800 flex-shrink-0">
              {currentTrack.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-neutral-800 to-neutral-700">
                  <Play className="w-6 h-6 text-neutral-500" />
                </div>
              )}
              {isLoadingStream && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">
                {currentTrack.title || 'Select a track'}
              </span>
              <span className="text-xs text-neutral-400 truncate">
                {getArtistName(currentTrack)}
              </span>
            </div>

            <button
              onClick={() => onToggleLike && onToggleLike(currentTrack?.id)}
              className="text-neutral-400 hover:text-[#fa2d48] transition-colors ml-1 p-1"
              title={isLiked ? 'Unlike song on YouTube' : 'Like song on YouTube'}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#fa2d48] text-[#fa2d48]' : ''}`} />
            </button>
          </>
        ) : (
          <div className="text-xs text-neutral-500 italic">No track playing</div>
        )}
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-[620px]">
        <div className="flex items-center gap-5">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`transition-colors ${isShuffle ? 'text-[#fa2d48]' : 'text-neutral-400 hover:text-white'}`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrevious}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-10 h-10 rounded-full bg-white text-neutral-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-40"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoadingStream ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() =>
              setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
            }
            className={`relative transition-colors ${
              repeatMode !== 'off' ? 'text-[#fa2d48]' : 'text-neutral-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            <Repeat className="w-4 h-4" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold">1</span>
            )}
          </button>
        </div>

        {/* Scrubber */}
        <div className="w-full flex items-center gap-3 text-xs text-neutral-400 font-mono">
          <span className="w-9 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            className="w-full flex-1"
          />
          <span className="w-9">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Lyrics & Volume */}
      <div className="flex items-center justify-end gap-4 w-1/4 min-w-[180px]">
        <button
          onClick={onOpenLyrics}
          className="text-neutral-400 hover:text-white transition-colors"
          title="Lyrics"
        >
          <FileText className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <button onClick={toggleMute} className="text-neutral-400 hover:text-white">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24"
          />
        </div>
      </div>
    </footer>
  );
}
