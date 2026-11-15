import React from 'react';
import { Play, Pause, Music, Clock, Heart } from 'lucide-react';
import { getArtistName } from '../utils/format';

export default function TrackList({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  likedSongIds,
  onToggleLike,
}) {
  if (!tracks || tracks.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-500 text-sm">
        No tracks found.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="grid grid-cols-[48px_1fr_120px] md:grid-cols-[48px_1fr_1fr_130px] px-3 py-2 text-xs font-semibold text-neutral-400 border-b border-white/5 uppercase tracking-wider">
        <span>#</span>
        <span>Title</span>
        <span className="hidden md:block">Album</span>
        <span className="text-right flex items-center justify-end gap-1">
          <Clock className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-white/[0.02]">
        {tracks.map((track, idx) => {
          const isCurrent = currentTrack?.id === track.id;
          const isLiked = likedSongIds && track.id ? likedSongIds.has(track.id) : false;

          return (
            <div
              key={track.id || idx}
              onClick={() => onSelectTrack(track, tracks)}
              className={`group grid grid-cols-[48px_1fr_120px] md:grid-cols-[48px_1fr_1fr_130px] items-center px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-white/10 text-white font-medium'
                  : 'hover:bg-white/[0.05] text-neutral-200'
              }`}
            >
              {/* Number / Play Button */}
              <div className="flex items-center text-sm font-medium text-neutral-400 group-hover:text-white">
                <span className="group-hover:hidden">
                  {isCurrent && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-1 bg-[#fa2d48] animate-pulse h-3"></span>
                      <span className="w-1 bg-[#fa2d48] animate-pulse h-2"></span>
                      <span className="w-1 bg-[#fa2d48] animate-pulse h-3.5"></span>
                    </div>
                  ) : (
                    idx + 1
                  )}
                </span>
                <button className="hidden group-hover:flex items-center justify-center text-white">
                  {isCurrent && isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-[#fa2d48]" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
              </div>

              {/* Title & Artist */}
              <div className="flex items-center gap-3 min-w-0 pr-4">
                {track.thumbnail ? (
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Music className="w-4 h-4 text-neutral-500" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-sm font-medium truncate ${
                      isCurrent ? 'text-[#fa2d48]' : 'text-white'
                    }`}
                  >
                    {track.title}
                  </span>
                  <span className="text-xs text-neutral-400 truncate">
                    {getArtistName(track)}
                  </span>
                </div>
              </div>

              {/* Album (Desktop) */}
              <div className="hidden md:flex items-center text-xs text-neutral-400 truncate pr-4">
                {track.album?.name || '—'}
              </div>

              {/* Duration & Like Button */}
              <div className="flex items-center justify-end gap-3 text-xs text-neutral-400">
                {onToggleLike && track.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(track.id);
                    }}
                    className="p-1 text-neutral-400 hover:text-[#fa2d48] transition-colors"
                    title={isLiked ? 'Unlike song on YouTube' : 'Like song on YouTube'}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${
                        isLiked
                          ? 'fill-[#fa2d48] text-[#fa2d48]'
                          : 'opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    />
                  </button>
                )}
                <span className="font-mono">{track.duration || '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
