import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import DiscoveryView from "./components/DiscoveryView";
import RadioView from "./components/RadioView";
import SearchView from "./components/SearchView";
import PlaylistView from "./components/PlaylistView";
import HistoryView from "./components/HistoryView";
import ArtistsView from "./components/ArtistsView";
import LibraryView from "./components/LibraryView";
import LyricsModal from "./components/LyricsModal";
import QueuePanel from "./components/QueuePanel";
import ListenTogetherPanel from "./components/ListenTogetherPanel";
import ContextMenu from "./components/ContextMenu";
import AnimatedPresence from "./components/AnimatedPresence";
import SettingsView from "./components/SettingsView";
import AboutDialog from "./components/AboutDialog";
import ArtworkBackdrop from "./components/ArtworkBackdrop";
import { DeveloperNewsPopup, DeveloperNewsView } from "./components/DeveloperNews";
import {
  SplashExperience,
  WelcomeExperience,
} from "./components/IntroExperience";
import { usePreferences } from "./utils/preferences";
import { useRemoteArtwork } from "./utils/remoteArtwork";
import { getArtistName } from "./utils/format";
import { useDeveloperNews } from "./utils/developerNews";

const tabLabels = {
  home: "Home",
  search: "Search",
  playlists: "Playlists",
  artists: "Artists",
  albums: "Albums",
  songs: "Songs",
  favorites: "Favorite Songs",
  history: "Recently Played",
  new: "New",
  radio: "Radio",
  news: "News from dev",
  settings: "Settings",
};

function shuffledCopy(tracks) {
  const result = [...tracks];
  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

const getTrackVideoId = (track) => track?.videoId || track?.id;

function playableTracks(tracks = []) {
  return tracks.filter(
    (item) =>
      item?.id &&
      !/album|playlist|artist/i.test(item.type || "") &&
      !/^(MPRE|VL|PL|RD|UC|OLAK)/.test(item.id),
  );
}

function mergeUniqueTracks(...groups) {
  const seen = new Set();
  return groups.flat().filter((track) => {
    const id = track?.videoId || track?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sharedQueueTrack(item) {
  const id = item?.id || item?.songId;
  if (!id) return null;
  return {
    id,
    videoId: id,
    title: item.title || "Unknown Song",
    artists: [{ name: item.artist || "iShare" }],
    thumbnail:
      item.thumbnailUrl || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    durationSeconds: item.durationMs ? item.durationMs / 1000 : 0,
    type: "track",
  };
}

export default function App() {
  const [navigation, setNavigation] = useState({
    entries: [{ tab: "home" }],
    index: 0,
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({ isLoggedIn: false });
  const developerNews = useDeveloperNews();
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [lyricsCompact, setLyricsCompact] = useState(true);
  const [sceneArtwork, setSceneArtwork] = useState(null);
  const [homeArtwork, setHomeArtwork] = useState(null);
  const { preferences } = usePreferences();
  const updatesStarted = useRef(false);
  const refreshUpdates = useCallback(async () => {
    const result = await window.api.updates.check();
    setUpdateResult(result);
    setDownloadProgress(null);
    return result;
  }, []);
  useEffect(() => {
    const unsubscribe = window.api.updates.onDownloadProgress(setDownloadProgress);
    return unsubscribe;
