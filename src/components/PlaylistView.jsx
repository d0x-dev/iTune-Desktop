import React, { useState, useEffect } from 'react';
import { Library, Play, ArrowLeft, Loader2, Music, UserCheck, Plus, Trash2, X } from 'lucide-react';
import TrackList from './TrackList';

export default function PlaylistView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New Playlist Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const data = await window.api.yt.getPlaylists();
      setPlaylists(data?.playlists || []);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }
    loadPlaylists();
  }, [userProfile?.isLoggedIn]);

  const handleOpenPlaylist = async (playlist) => {
    setSelectedPlaylist(playlist);
    setLoadingDetail(true);
    try {
      const data = await window.api.yt.getPlaylist(playlist.id);
      setPlaylistDetail(data);
    } catch (err) {
      console.error('Failed to fetch playlist tracks:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreatePlaylist = async (e) => {
    e?.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    try {
      const res = await window.api.yt.createPlaylist({ title: newTitle.trim() });
      if (res?.ok) {
        setNewTitle('');
        setShowCreateModal(false);
        await loadPlaylists();
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist?.id || deleting) return;
    if (selectedPlaylist.id.includes('LM')) return; // Do not delete Liked Music

    if (!window.confirm(`Are you sure you want to delete "${selectedPlaylist.title}" from your YouTube Music account?`)) {
      return;
    }

    setDeleting(true);
    try {
      await window.api.yt.deletePlaylist(selectedPlaylist.id);
      setSelectedPlaylist(null);
      setPlaylistDetail(null);
      await loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (!userProfile?.isLoggedIn) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Library className="w-8 h-8 text-[#fa2d48]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Your YouTube Music Playlists</h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Connect your Google account to access your personal playlists, liked songs, and saved albums directly inside iTune Desktop without needing any extension.
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

  // Playlist Detail View
  if (selectedPlaylist) {
    const isCustomPlaylist = !selectedPlaylist.id.includes('LM');

    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        <button
          onClick={() => {
            setSelectedPlaylist(null);
            setPlaylistDetail(null);
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Playlists
        </button>

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-400">
            <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
            <span className="text-xs">Loading playlist tracks...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 pt-2">
              <div className="w-48 h-48 rounded-2xl overflow-hidden bg-neutral-800 shadow-2xl flex-shrink-0">
                {selectedPlaylist.thumbnail || playlistDetail?.thumbnail ? (
                  <img
                    src={selectedPlaylist.thumbnail || playlistDetail?.thumbnail}
                    alt={selectedPlaylist.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                    <Music className="w-16 h-16 text-neutral-600" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <span className="text-xs uppercase font-bold tracking-wider text-[#fa2d48]">
                  Playlist
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight truncate">
                  {selectedPlaylist.title}
                </h1>
                <p className="text-xs text-neutral-400">
                  {playlistDetail?.tracks?.length || 0} songs · Created by {selectedPlaylist.author || userProfile.name}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  {playlistDetail?.tracks?.length > 0 && (
                    <button
                      onClick={() => onSelectTrack(playlistDetail.tracks[0], playlistDetail.tracks)}
                      className="px-6 py-2.5 rounded-xl bg-[#fa2d48] hover:bg-[#fa586a] text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-[#fa2d48]/30 transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Play All
                    </button>
                  )}

                  {isCustomPlaylist && (
                    <button
                      onClick={handleDeletePlaylist}
                      disabled={deleting}
                      className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 font-semibold text-xs flex items-center gap-2 transition-all border border-white/10 active:scale-95"
                      title="Delete playlist from YouTube"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Delete Playlist</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tracks */}
            <TrackList
              tracks={playlistDetail?.tracks || []}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectTrack={onSelectTrack}
              likedSongIds={likedSongIds}
              onToggleLike={onToggleLike}
            />
          </div>
        )}
      </div>
    );
  }

  // Playlists Grid View
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Your Playlists</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Synced directly from your YouTube Music library</p>
        </div>

        {/* Real-Time Create Playlist Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-[#fa2d48] hover:bg-[#fa586a] text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-[#fa2d48]/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
          <span className="text-xs">Loading your playlists from YouTube Music...</span>
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {playlists.map((pl, idx) => (
            <div
              key={pl.id || idx}
              onClick={() => handleOpenPlaylist(pl)}
              className="glass-card group p-3 flex flex-col gap-2.5 cursor-pointer relative"
            >
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-800 relative shadow-md">
                {pl.thumbnail ? (
                  <img
                    src={pl.thumbnail}
                    alt={pl.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Music className="w-10 h-10 text-neutral-600" />
                  </div>
                )}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const data = await window.api.yt.getPlaylist(pl.id);
                    if (data?.tracks?.length > 0) {
                      onSelectTrack(data.tracks[0], data.tracks);
                    }
                  }}
                  className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#fa2d48] text-white flex items-center justify-center shadow-lg shadow-[#fa2d48]/40 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200"
                  title={`Play ${pl.title}`}
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate group-hover:text-[#fa2d48] transition-colors">
                  {pl.title}
                </span>
                <span className="text-xs text-neutral-400 truncate mt-0.5">
                  {pl.itemCount ? `${pl.itemCount} items` : 'Playlist'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-neutral-500 text-sm">
          No playlists found in your YouTube Music account.
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121318] border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create YouTube Music Playlist</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Create a new playlist that will be synced in real time to your YouTube Music account.
            </p>

            <form onSubmit={handleCreatePlaylist} className="flex flex-col gap-4 mt-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Playlist name..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#fa2d48] focus:ring-1 focus:ring-[#fa2d48]"
                autoFocus
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || creating}
                  className="px-5 py-2 rounded-xl bg-[#fa2d48] hover:bg-[#fa586a] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#fa2d48]/30 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create on YouTube</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
