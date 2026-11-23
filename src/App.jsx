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
  }, []);
  useEffect(() => {
    if (updatesStarted.current) return;
    updatesStarted.current = true;
    refreshUpdates().catch((error) => {
      setUpdateResult({ ok: false, error: error.message });
    });
  }, [refreshUpdates]);
  const [preferredName, setPreferredName] = useState(() =>
    localStorage.getItem("itune:display-name") || "",
  );
  const [introStage, setIntroStage] = useState(() => {
    const welcomeCompleted =
      localStorage.getItem("itune:welcome-completed") === "true";
    if (preferences.splashScreenEnabled)
      return welcomeCompleted ? "splash-app" : "splash-welcome";
    return welcomeCompleted ? null : "welcome";
  });
  const [welcomeFromSplash, setWelcomeFromSplash] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
      const theme =
        preferences.theme === "system"
          ? systemDark
            ? "dark"
            : "light"
          : preferences.theme;
      window.api.window?.setAppearance?.(
        introStage ? "dark" : theme,
        introStage ? false : preferences.desktopTransparency,
      );
    }, 0);
    return () => clearTimeout(timeout);
  }, [introStage, preferences.desktopTransparency, preferences.theme]);
  const trackArtwork = useRemoteArtwork(
    "getCanvas",
    currentTrack
      ? {
          title: currentTrack.title,
          artist: getArtistName(currentTrack),
          album: currentTrack.album?.name,
        }
      : null,
    preferences.motion,
  );
  const [showQueue, setShowQueue] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [endlessQueueEnabled, setEndlessQueueEnabled] = useState(() =>
    localStorage.getItem("itune:endless-queue") !== "false",
  );
  const [showListenTogether, setShowListenTogether] = useState(false);
  const [listenTogether, setListenTogether] = useState(null);
  const [listenBusy, setListenBusy] = useState(false);
  const [listenError, setListenError] = useState("");
  const [lanHosts, setLanHosts] = useState([]);
  const [scanningLan, setScanningLan] = useState(false);
  const [localLanIp, setLocalLanIp] = useState("");
  const [ishareSettings, setIshareSettings] = useState({
    allowGuestsToControlPlayback: false,
    allowGuestsToAddTracks: true,
  });
  const [playback, setPlayback] = useState({
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });
  const [likedSongIds, setLikedSongIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [contextPlaylists, setContextPlaylists] = useState([]);
  const player = useRef(null);
  const content = useRef(null);
  const playbackRef = useRef(playback);
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const currentTrackRef = useRef(currentTrack);
  const isPlayingRef = useRef(isPlaying);
  const listenTogetherRef = useRef(listenTogether);
  const likeRequests = useRef(new Set());
  const originalQueue = useRef([]);
  const queueGeneration = useRef(0);
  const queueRequests = useRef(new Set());
  const fetchedQueueSeeds = useRef(new Set());
  const view = navigation.entries[navigation.index];
  const activeTab = view.tab;
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    listenTogetherRef.current = listenTogether;
  }, [listenTogether]);
  useEffect(() => {
    localStorage.setItem(
      "itune:endless-queue",
      String(endlessQueueEnabled),
    );
  }, [endlessQueueEnabled]);
  useEffect(() => {
    if (!["artists", "albums", "playlists"].includes(activeTab)) {
      setSceneArtwork(null);
    }
  }, [activeTab]);
  const updatePlayback = useCallback(
    (snapshot) => {
      playbackRef.current = snapshot;
      if (showLyrics) setPlayback(snapshot);
    },
    [showLyrics],
  );
