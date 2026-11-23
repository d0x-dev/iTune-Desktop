import React, { useEffect, useState } from "react";
import {
  Library,
  Play,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  X,
  Shuffle,
} from "lucide-react";
import TrackList from "./TrackList";
import Artwork from "./Artwork";
import ArtworkBackdrop from "./ArtworkBackdrop";
import ExplicitTitle from "./ExplicitTitle";
import AnimatedPresence from "./AnimatedPresence";

export default function PlaylistView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
  initialPlaylist,
  onShuffleTracks,
  onArtworkChange,
  onContextMenu,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(initialPlaylist || null);
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    onArtworkChange?.(
      selected ? { heroUrl: selected.thumbnail || detail?.thumbnail } : null,
    );
    return () => onArtworkChange?.(null);
  }, [selected?.id, detail?.thumbnail, onArtworkChange]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let active = true;
    setPlaylists([]);
    setError("");
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.api.yt
      .getPlaylists()
      .then((data) => {
        if (!active) return;
        if (data?.error) throw new Error(data.error);
        setPlaylists(data?.playlists || []);
      })
      .catch(() => {
        if (active) setError("Your playlists couldn’t load. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.isLoggedIn, reload]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    if (!selected?.id) return;
    setLoadingDetail(true);
    window.api.yt
      .getPlaylist(selected.id.replace(/^VL/, ""))
      .then((data) => {
        if (!active) return;
        if (data?.error) throw new Error(data.error);
        setDetail(data);
      })
      .catch(() => {
        if (active) setError("This playlist couldn’t load.");
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);
  useEffect(() => {
    if (initialPlaylist) setSelected(initialPlaylist);
  }, [initialPlaylist]);

  const createPlaylist = async (event) => {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const result = await window.api.yt.createPlaylist({
        title: title.trim(),
      });
      if (!result?.ok)
        throw new Error(result?.error || "This playlist couldn’t be created.");
      setShowCreate(false);
