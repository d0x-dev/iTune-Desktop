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
