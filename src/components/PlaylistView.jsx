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
