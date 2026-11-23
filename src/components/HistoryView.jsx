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
