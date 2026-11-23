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
    album ? { title: album.title, artist: getArtistName(album) } : null,
  );
  useEffect(() => {
    onArtworkChange?.(
      album
        ? {
            heroUrl:
              albumArtwork?.heroUrl || album.thumbnail || detail?.thumbnail,
            videoUrl: albumArtwork?.videoUrl,
          }
        : null,
    );
    return () => onArtworkChange?.(null);
  }, [album?.id, albumArtwork, detail?.thumbnail, onArtworkChange]);
  const [loading, setLoading] = useState(true);
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const title =
    mode === "albums"
      ? "Albums"
      : mode === "favorites"
        ? "Favorite Songs"
        : "Songs";

  useEffect(() => {
    let active = true;
    setItems([]);
    setQuery("");
    setError("");
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const request =
