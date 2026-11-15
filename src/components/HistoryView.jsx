import React, { useState, useEffect } from 'react';
import { History, Loader2, UserCheck } from 'lucide-react';
import TrackList from './TrackList';

export default function HistoryView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
}) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }

    async function loadHistory() {
      setLoading(true);
      try {
        const data = await window.api.yt.getHistory();
        setSections(data?.sections || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [userProfile?.isLoggedIn]);

  if (!userProfile?.isLoggedIn) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <History className="w-8 h-8 text-[#fa2d48]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Your Listening History</h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Connect your Google account to view your YouTube Music playback history and seamlessly pick up where you left off.
          </p>
        </div>
        <button
          onClick={onLogin}
          className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-xs bg-white text-neutral-950 hover:bg-neutral-100 transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <UserCheck className="w-4 h-4 text-[#fa2d48]" />
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Listening History</h2>
        <p className="text-xs text-neutral-400 mt-0.5">Recently played songs from your YouTube Music account</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
          <span className="text-xs">Fetching your playback history...</span>
        </div>
      ) : sections.length > 0 ? (
        sections.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-neutral-300 tracking-tight">
              {section.title}
            </h3>
            <TrackList
              tracks={section.contents}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectTrack={onSelectTrack}
              likedSongIds={likedSongIds}
              onToggleLike={onToggleLike}
            />
          </div>
        ))
      ) : (
        <div className="py-20 text-center text-neutral-500 text-sm">
          No recent playback history found in this account.
        </div>
      )}
    </div>
  );
}
