import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import PlaylistView from './components/PlaylistView';
import HistoryView from './components/HistoryView';
import ArtistsView from './components/ArtistsView';
import LyricsModal from './components/LyricsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({ isLoggedIn: false });
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Set of liked video IDs synced with YouTube Music
  const [likedSongIds, setLikedSongIds] = useState(new Set());

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        setAuthLoading(true);
        const profile = await window.api.auth.getStatus();
        if (isMounted && profile) {
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Error getting auth status:', err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    }

    checkAuth();
    const unsubscribe = window.api.onAuthChanged((newProfile) => {
      if (isMounted && newProfile) {
        setUserProfile(newProfile);
        setAuthLoading(false);
      }
    });

    // Listen for background player track changes (e.g. YouTube Music autoplaying the next track)
    const unsubTrack = window.api.player?.onTrackChanged((track) => {
      if (!track?.id) return;
      setCurrentTrack(track);

      setQueue((prevQueue) => {
        const idx = prevQueue.findIndex((t) => t.id === track.id);
        if (idx !== -1) {
          setCurrentIndex(idx);
          return prevQueue;
        } else {
          return [...prevQueue, track];
        }
      });
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      if (unsubTrack) unsubTrack();
    };
  }, []);

  // Fetch Liked Songs when user logs in or starts up
  useEffect(() => {
    if (!userProfile?.isLoggedIn) {
      setLikedSongIds(new Set());
      return;
    }

    window.api.yt
      ?.getLikedSongs()
      .then((data) => {
        if (data?.tracks && Array.isArray(data.tracks)) {
          const ids = new Set(data.tracks.map((t) => t.id).filter(Boolean));
          setLikedSongIds(ids);
        }
      })
      .catch((err) => {
        console.error('Error loading liked songs:', err);
      });
  }, [userProfile?.isLoggedIn]);

  // Real-time Like/Unlike toggle synced to YouTube account
  const handleToggleLike = async (videoId) => {
    if (!videoId) return;

    const isCurrentlyLiked = likedSongIds.has(videoId);
    const nextSet = new Set(likedSongIds);

    if (isCurrentlyLiked) {
      nextSet.delete(videoId);
      setLikedSongIds(nextSet);
      try {
        await window.api.yt.unlikeSong(videoId);
      } catch (e) {
        console.error('Failed to sync unlike:', e);
        nextSet.add(videoId);
        setLikedSongIds(new Set(nextSet));
      }
    } else {
      nextSet.add(videoId);
      setLikedSongIds(nextSet);
      try {
        await window.api.yt.likeSong(videoId);
      } catch (e) {
        console.error('Failed to sync like:', e);
        nextSet.delete(videoId);
        setLikedSongIds(new Set(nextSet));
      }
    }
  };

  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      const res = await window.api.auth.login();
      if (res?.userProfile) {
        setUserProfile(res.userProfile);
      } else {
        const profile = await window.api.auth.getStatus();
        if (profile) setUserProfile(profile);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setAuthLoading(true);
      const res = await window.api.auth.logout();
      setUserProfile(res.userProfile || { isLoggedIn: false });
      setLikedSongIds(new Set());
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Track Selection and Queue management
  const handleSelectTrack = (track, trackList = []) => {
    setCurrentTrack(track);
    if (trackList.length > 0) {
      setQueue(trackList);
      const idx = trackList.findIndex((t) => t.id === track.id);
      setCurrentIndex(idx !== -1 ? idx : 0);
    } else {
      setQueue([track]);
      setCurrentIndex(0);
    }
  };

  const handleNext = () => {
    if (queue.length > 0 && currentIndex !== -1 && currentIndex + 1 < queue.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentTrack(queue[nextIdx]);
    } else {
      window.api.player?.next();
    }
  };

  const handlePrevious = () => {
    if (queue.length > 0 && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setCurrentTrack(queue[prevIdx]);
    } else {
      window.api.player?.previous();
    }
  };

  return (
    <div className="app-container">
      {/* Draggable Title Bar for Windows */}
      <div className="h-9 w-full bg-[#07080a] flex items-center justify-between px-4 select-none [-webkit-app-region:drag] z-50 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
          <span>iTune</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-300 capitalize">{activeTab}</span>
        </div>
      </div>

      <div className="main-body">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
          authLoading={authLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        {/* Content Area */}
        <main className="content-area">
          {activeTab === 'home' && (
            <HomeView
              onSelectTrack={handleSelectTrack}
              userProfile={userProfile}
              authLoading={authLoading}
              onLogin={handleLogin}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              onSelectTrack={handleSelectTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongIds={likedSongIds}
              onToggleLike={handleToggleLike}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistView
              onSelectTrack={handleSelectTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              userProfile={userProfile}
              onLogin={handleLogin}
              likedSongIds={likedSongIds}
              onToggleLike={handleToggleLike}
            />
          )}

          {activeTab === 'artists' && (
            <ArtistsView
              onSelectTrack={handleSelectTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              userProfile={userProfile}
              onLogin={handleLogin}
              likedSongIds={likedSongIds}
              onToggleLike={handleToggleLike}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              onSelectTrack={handleSelectTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              userProfile={userProfile}
              onLogin={handleLogin}
              likedSongIds={likedSongIds}
              onToggleLike={handleToggleLike}
            />
          )}
        </main>
      </div>

      {/* Bottom Audio Player Bar */}
      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onOpenLyrics={() => setShowLyrics(true)}
        isLiked={currentTrack ? likedSongIds.has(currentTrack.id) : false}
        onToggleLike={() => handleToggleLike(currentTrack?.id)}
      />

      {/* Lyrics Modal */}
      {showLyrics && (
        <LyricsModal
          track={currentTrack}
          onClose={() => setShowLyrics(false)}
        />
      )}
    </div>
  );
}
