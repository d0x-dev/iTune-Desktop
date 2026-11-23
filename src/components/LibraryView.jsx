import React, { useEffect, useState } from "react";
import {
  Disc3,
  Music2,
  Play,
  Shuffle,
  Search,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import TrackList from "./TrackList";
import Artwork from "./Artwork";
import { getArtistName } from "../utils/format";
import ArtworkBackdrop from "./ArtworkBackdrop";
import Canvas from "./Canvas";
import ExplicitTitle from "./ExplicitTitle";
import { useRemoteArtwork } from "../utils/remoteArtwork";

export default function LibraryView({
  mode,
  userProfile,
  onLogin,
  onSelectTrack,
  onShuffleTracks,
  currentTrack,
  isPlaying,
  likedSongIds,
  onToggleLike,
  initialAlbum,
  onArtworkChange,
  onContextMenu,
}) {
  const [items, setItems] = useState([]);
  const [album, setAlbum] = useState(initialAlbum || null);
  const [detail, setDetail] = useState(null);
  const albumArtwork = useRemoteArtwork(
    "getAlbum",
