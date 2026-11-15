import React, { useState, useEffect } from 'react';
import { X, Loader2, Music } from 'lucide-react';

export default function LyricsModal({ track, onClose }) {
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!track?.id) return;

    async function loadLyrics() {
      setLoading(true);
      try {
        const data = await window.api.yt.getLyrics(track.id);
        setLyrics(data?.lyrics || null);
      } catch (err) {
        console.error('Failed to load lyrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLyrics();
  }, [track?.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-neutral-900/90 border border-white/10 p-8 flex flex-col gap-6 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {track?.thumbnail && (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="w-12 h-12 rounded-xl object-cover shadow-md"
              />
            )}
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-white truncate">{track?.title}</h3>
              <p className="text-xs text-neutral-400 truncate">
                {track?.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lyrics Content */}
        <div className="flex-1 overflow-y-auto pr-2 text-center py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
              <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
              <span className="text-xs">Fetching lyrics from YouTube Music...</span>
            </div>
          ) : lyrics ? (
            <div className="whitespace-pre-line text-lg md:text-xl font-medium text-neutral-200 leading-relaxed font-sans space-y-4">
              {lyrics}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <Music className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
              <p className="text-sm">No lyrics found for this track.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
