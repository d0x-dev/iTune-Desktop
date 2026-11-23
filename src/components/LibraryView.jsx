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
      mode === "albums"
        ? window.api.yt.getAlbums()
        : mode === "favorites"
          ? window.api.yt.getLikedSongs()
          : window.api.yt.getSongs();
    request
      .then((data) => {
        if (!active) return;
        if (data?.error) throw new Error(data.error);
        setItems(mode === "albums" ? data?.albums || [] : data?.tracks || []);
      })
      .catch(() => {
        if (active) setError("Your library couldn’t load. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, userProfile?.isLoggedIn, retry]);

  useEffect(() => {
    if (initialAlbum) setAlbum(initialAlbum);
  }, [initialAlbum]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    if (!album) return;
    setLoadingAlbum(true);
    setError("");
    window.api.yt
      .getAlbum(album.id)
      .then((data) => {
        if (!active) return;
        if (data?.error) throw new Error(data.error);
        setDetail(data);
      })
      .catch(() => {
        if (active) setError("This album couldn’t load.");
      })
      .finally(() => {
        if (active) setLoadingAlbum(false);
      });
    return () => {
      active = false;
    };
  }, [album?.id]);

  const filtered = items.filter(
    (item) =>
      (mode !== "favorites" || likedSongIds?.has(item.videoId || item.id)) &&
      `${item.title} ${getArtistName(item)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const sorted =
    sort === "recent"
      ? filtered
      : [...filtered].sort((a, b) =>
          sort === "artist"
            ? getArtistName(a).localeCompare(getArtistName(b))
            : a.title.localeCompare(b.title),
        );
  if (album)
    return (
      <div className="page collection-page">
        <ArtworkBackdrop
          src={albumArtwork?.heroUrl || album.thumbnail || detail?.thumbnail}
          canvas={albumArtwork?.videoUrl}
        />
        <button
          className="text-button back-link"
          onClick={() => setAlbum(null)}
        >
          <ArrowLeft size={16} />
          Albums
        </button>
        <header className="collection-header">
          <Artwork
            src={albumArtwork?.heroUrl || album.thumbnail || detail?.thumbnail}
            title={album.title}
            eager
          >
            <Canvas src={albumArtwork?.videoUrl} />
          </Artwork>
          <div>
            <span className="eyebrow">Album</span>
            <h1><ExplicitTitle item={album} /></h1>
            <h2>{getArtistName(album)}</h2>
            <p>{detail?.tracks?.length || 0} songs</p>
            <div className="collection-actions">
              <button
                className="primary-button"
                disabled={!detail?.tracks?.length}
                onClick={() => onSelectTrack(detail.tracks[0], detail.tracks)}
              >
                <Play size={15} fill="currentColor" />
                Play
              </button>
              <button
                className="secondary-button"
                disabled={!detail?.tracks?.length}
                onClick={() => onShuffleTracks(detail.tracks)}
              >
                <Shuffle size={15} />
                Shuffle
              </button>
            </div>
          </div>
        </header>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {loadingAlbum ? (
          <div className="empty-state">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <TrackList
            tracks={detail?.tracks || []}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={onSelectTrack}
            likedSongIds={likedSongIds}
            onToggleLike={onToggleLike}
            onContextMenu={onContextMenu}
          />
        )}
      </div>
    );
  return (
    <div className="page library-page">
      <header className="page-heading">
        <h1>{title}</h1>
        <p>
          {mode === "albums"
            ? "The records you keep coming back to."
            : "Your saved songs from YouTube Music."}
        </p>
      </header>
      {!userProfile?.isLoggedIn ? (
        <div className="empty-state">
          <Music2 />
          <h2>Your music, together</h2>
          <p>Sign in to bring your music library here.</p>
          <button className="primary-button" onClick={onLogin}>
            Sign In
          </button>
        </div>
      ) : (
        <>
          <div className="library-toolbar">
            <div className="collection-actions">
              {mode !== "albums" && (
                <>
                  <button
                    className="primary-button"
                    disabled={!sorted.length}
                    onClick={() => onSelectTrack(sorted[0], sorted)}
                  >
                    <Play size={14} fill="currentColor" />
                    Play
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!sorted.length}
                    onClick={() => onShuffleTracks(sorted)}
                  >
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                </>
              )}
            </div>
            <div className="library-filters">
              <label className="library-search">
                <Search size={15} />
                <input
                  aria-label={`Filter ${title}`}
                  placeholder="Filter"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
