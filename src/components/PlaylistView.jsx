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
      setTitle("");
      setReload((value) => value + 1);
    } catch (failure) {
      setCreateError(failure.message);
    } finally {
      setCreating(false);
    }
  };
  const deletePlaylist = async () => {
    if (
      deleting ||
      !window.confirm(
        `Delete “${selected.title}” from your YouTube Music library?`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      const result = await window.api.yt.deletePlaylist(selected.id);
      if (result?.error || result?.ok === false) throw new Error(result.error);
      setSelected(null);
      setReload((value) => value + 1);
    } catch {
      setError("This playlist couldn’t be deleted. Try again.");
    } finally {
      setDeleting(false);
    }
  };
  if (selected)
    return (
      <div className="page collection-page">
        <ArtworkBackdrop src={selected.thumbnail || detail?.thumbnail} />
        <button
          className="text-button back-link"
          onClick={() => setSelected(null)}
        >
          <ArrowLeft size={16} />
          Playlists
        </button>
        <header className="collection-header">
          <Artwork
            src={selected.thumbnail || detail?.thumbnail}
            title={selected.title}
            eager
          />
          <div>
            <span className="eyebrow">Playlist</span>
            <h1><ExplicitTitle item={selected} /></h1>
            <h2>{selected.author || userProfile?.name || "YouTube Music"}</h2>
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
              {userProfile?.isLoggedIn &&
                playlists.some((playlist) => playlist.id === selected.id) &&
                !/^(LM|RD)/.test(selected.id) && (
                  <button
                    className="icon-button"
                    disabled={deleting}
                    aria-label="Delete playlist"
                    onClick={deletePlaylist}
                  >
                    {deleting ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </button>
                )}
            </div>
          </div>
        </header>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {loadingDetail ? (
          <div className="empty-state">
            <Loader2 className="animate-spin" />
            <p>Loading playlist…</p>
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
    <div className="page">
      <header className="page-heading">
        <div className="section-heading">
          <h1>Playlists</h1>
          {userProfile?.isLoggedIn && (
            <button
              className="primary-button"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              New Playlist
            </button>
          )}
        </div>
        <p>A collection for every mood.</p>
      </header>
      {!userProfile?.isLoggedIn ? (
        <div className="empty-state">
          <Library />
          <h2>Bring your playlists along</h2>
          <p>Sign in to access your YouTube Music playlists.</p>
          <button className="primary-button" onClick={onLogin}>
            Sign In
          </button>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" />
          <p>Loading playlists…</p>
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
