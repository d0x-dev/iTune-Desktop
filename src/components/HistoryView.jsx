import React, { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import TrackList from "./TrackList";

export default function HistoryView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
  onContextMenu,
}) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setSections([]);
    setError("");
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.api.yt
      .getHistory()
      .then((data) => {
        if (active) {
          setSections(data?.sections || []);
          if (data?.error) setError("Your listening history couldn’t load.");
        }
      })
      .catch(() => {
        if (active) setError("Your listening history couldn’t load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.isLoggedIn, reload]);
  return (
    <div className="page">
      <header className="page-heading">
        <h1>Recently Played</h1>
        <p>Pick up where you left off.</p>
      </header>
      {!userProfile?.isLoggedIn ? (
        <div className="empty-state">
          <History />
          <h2>Your recent favorites</h2>
          <p>Sign in to see your listening history.</p>
          <button className="primary-button" onClick={onLogin}>
            Sign In
          </button>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" />
          <p>Loading recent music…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <h2>Let’s try again</h2>
          <p role="alert">{error}</p>
          <button
            className="primary-button"
            onClick={() => setReload((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : sections.length ? (
        sections.map((section, index) => (
          <section className="history-section" key={index}>
            <h2>{section.title}</h2>
            <TrackList
              tracks={section.contents}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectTrack={onSelectTrack}
              likedSongIds={likedSongIds}
              onToggleLike={onToggleLike}
              onContextMenu={onContextMenu}
            />
          </section>
        ))
      ) : (
        <div className="empty-state">
          <History />
          <h2>Start a new rotation</h2>
          <p>The songs you listen to on YouTube Music will appear here.</p>
        </div>
      )}
    </div>
  );
}
