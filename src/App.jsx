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

  const navigate = useCallback((tab, data = {}) => {
    setNavigation((previous) => {
      if (
        previous.entries[previous.index].tab === tab &&
        !Object.keys(data).length
      )
        return previous;
      return {
        entries: [
          ...previous.entries.slice(0, previous.index + 1),
          { tab, ...data },
        ],
        index: previous.index + 1,
      };
    });
  }, []);

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [view]);
  useEffect(() => {
    let mounted = true;
    window.api.auth
      .getStatus()
      .then((profile) => {
        if (mounted && profile) setUserProfile(profile);
      })
      .catch(() => {
        if (mounted)
          setMessage("Your account couldn’t connect. Try signing in again.");
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    const unsubscribe = window.api.onAuthChanged((profile) => {
      if (mounted && profile) {
        setUserProfile(profile);
        setAuthLoading(false);
      }
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!userProfile.isLoggedIn || !userProfile.name) return;
    setPreferredName(userProfile.name);
    localStorage.setItem("itune:display-name", userProfile.name);
  }, [userProfile.isLoggedIn, userProfile.name]);
  useEffect(() => {
    let active = true;
    setLikedSongIds(new Set());
    if (!userProfile.isLoggedIn) return;
    window.api.yt
      .getLikedSongs()
      .then((data) => {
        if (active)
          setLikedSongIds(
            new Set((data?.tracks || []).map(getTrackVideoId).filter(Boolean)),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userProfile.isLoggedIn]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timeout);
  }, [message]);
  useEffect(() => {
    const expanded = showLyrics && !lyricsCompact;
    document.documentElement.dataset.lyricsFullscreen = String(expanded);
    window.api.window?.setLyricsFullscreen?.(expanded);
    return () => {
      document.documentElement.dataset.lyricsFullscreen = "false";
      window.api.window?.setLyricsFullscreen?.(false);
    };
  }, [showLyrics, lyricsCompact]);

  const login = async () => {
    setAuthLoading(true);
    try {
      const result = await window.api.auth.login();
      if (result?.error) throw new Error(result.error);
      const profile =
        result?.userProfile || (await window.api.auth.getStatus());
      if (profile) setUserProfile(profile);
      return profile;
    } catch (failure) {
      setMessage(failure.message || "Sign-in couldn’t finish. Try again.");
      return null;
    } finally {
      setAuthLoading(false);
    }
  };
  const logout = async () => {
    setAuthLoading(true);
    try {
      const result = await window.api.auth.logout();
      setUserProfile(result?.userProfile || { isLoggedIn: false });
      setLikedSongIds(new Set());
    } catch {
      setMessage("Sign-out couldn’t finish. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };
  const toggleLike = async (id) => {
    if (!id || likeRequests.current.has(id)) return;
    if (!userProfile.isLoggedIn) {
      login();
      return;
    }
    const wasLiked = likedSongIds.has(id);
    const updateLike = (liked) =>
      setLikedSongIds((previous) => {
        const next = new Set(previous);
        if (liked) next.add(id);
        else next.delete(id);
        return next;
      });
    likeRequests.current.add(id);
    updateLike(!wasLiked);
    try {
      const result = await (wasLiked
        ? window.api.yt.unlikeSong(id)
        : window.api.yt.likeSong(id));
      if (result?.error || result?.ok === false) throw new Error(result.error);
      setMessage(
        wasLiked
          ? "Removed from YouTube Music liked songs."
          : "Added to YouTube Music liked songs.",
      );
    } catch {
      updateLike(wasLiked);
      setMessage("Your favorite couldn’t be saved. Try again.");
    } finally {
      likeRequests.current.delete(id);
    }
  };

  const extendRelatedQueue = useCallback(async (seed, generation) => {
    const seedId = seed?.videoId || seed?.id;
    if (!seedId || seed?.type === "radio") return queueRef.current;
    const requestKey = `${seedId}:${seed.playlistId || ""}`;
    if (
      queueRequests.current.has(requestKey) ||
      fetchedQueueSeeds.current.has(requestKey)
    )
      return queueRef.current;
    queueRequests.current.add(requestKey);
    try {
      const result = await window.api.yt.getRadioQueue(
        seedId,
        seed.playlistId,
      );
      if (result?.error) throw new Error(result.error);
      if (
        generation != null &&
        generation !== queueGeneration.current
      )
        return queueRef.current;
      const related = playableTracks(result?.tracks || []);
      if (!related.length) return queueRef.current;
      fetchedQueueSeeds.current.add(requestKey);
      const merged = mergeUniqueTracks(queueRef.current, related);
      if (merged.length !== queueRef.current.length) {
        queueRef.current = merged;
        originalQueue.current = mergeUniqueTracks(originalQueue.current, related);
        setQueue(merged);
      }
      return merged;
    } catch {
      return queueRef.current;
    } finally {
      queueRequests.current.delete(requestKey);
    }
  }, []);

  const selectTrack = (track, list = []) => {
    if (!track?.id) return;
    const type = String(track.type || "").toLowerCase();
    if (type.includes("artist") || track.id.startsWith("UC")) {
      navigate("artists", {
        artist: { ...track, name: track.name || track.title },
      });
      return;
    }
    if (type.includes("album") || track.id.startsWith("MPRE")) {
      navigate("albums", { album: track });
      return;
    }
    if (
      type.includes("playlist") ||
      type === "podcast" ||
      /^(VL|PL|RD|OLAK)/.test(track.id)
    ) {
      navigate("playlists", { playlist: track });
      return;
    }
    if (currentTrack?.id === track.id) {
      player.current?.togglePlay();
      return;
    }
    if (list === queue) {
      const nextIndex = queue.findIndex((item) => item.id === track.id);
      currentIndexRef.current = nextIndex;
      currentTrackRef.current = track;
      setCurrentIndex(nextIndex);
      setCurrentTrack(track);
      return;
    }
    const tracks = playableTracks(list.length ? list : [track]);
    const index = tracks.findIndex((item) => item.id === track.id);
    const collection = index >= 0 ? tracks : [track];
    originalQueue.current = collection;
    const generatedQueue = isShuffle
      ? [
          track,
          ...shuffledCopy(collection.filter((item) => item.id !== track.id)),
        ]
      : collection;
    const generatedIndex = isShuffle ? 0 : Math.max(0, index);
    const generation = ++queueGeneration.current;
    queueRequests.current.clear();
    fetchedQueueSeeds.current.clear();
    queueRef.current = generatedQueue;
    currentIndexRef.current = generatedIndex;
    currentTrackRef.current = track;
    player.current?.preparePlayback(true);
    setQueue(generatedQueue);
    setCurrentIndex(generatedIndex);
    setCurrentTrack(track);
    if (track.type !== "radio") extendRelatedQueue(track, generation);
  };
  const shuffleTracks = (tracks) => {
    if (!tracks?.length) return;
    const shuffled = shuffledCopy(tracks);
    originalQueue.current = tracks;
    setIsShuffle(true);
    setQueue(shuffled);
    queueRef.current = shuffled;
    currentIndexRef.current = 0;
    currentTrackRef.current = shuffled[0];
    player.current?.preparePlayback(true);
    setCurrentIndex(0);
    if (currentTrack?.id === shuffled[0].id) player.current?.restart();
    else setCurrentTrack(shuffled[0]);
  };
  const startRadio = async (track) => {
    if (!track?.id) return;
    try {
      const result = await window.api.yt.getRadioQueue(
        track.videoId || track.id,
        track.playlistId,
      );
      if (!result?.tracks?.length)
        throw new Error("This station couldn’t start.");
      selectTrack(result.tracks[0], result.tracks);
    } catch {
      setMessage("This station couldn’t start. Try another song.");
    }
  };
  const openContextMenu = useCallback(
    (event, item = null, list = []) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - 270)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - 440)),
        item,
        list,
      });
      setContextPlaylists([]);
      if (item && userProfile.isLoggedIn) {
        window.api.yt
          .getPlaylists()
          .then((result) => setContextPlaylists(result?.playlists || []))
          .catch(() => {});
      }
    },
    [userProfile.isLoggedIn],
  );
  const handleContextAction = async (action, payload) => {
    const item = contextMenu?.item;
    if (["history", "library", "settings"].includes(action)) {
      navigate(
        action === "history" ? "history" : action === "library" ? "songs" : "settings",
      );
      return;
    }
    if (!item) return;
    if (action === "play") {
      selectTrack(item, contextMenu.list || []);
      return;
    }
