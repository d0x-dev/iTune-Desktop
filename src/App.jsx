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
    if (action === "next" || action === "queue") {
      if (!currentTrack) {
        selectTrack(item, [item]);
        return;
      }
      setQueue((previous) => {
        const withoutItem = previous.filter((track) => track.id !== item.id);
        if (action === "queue") return [...withoutItem, item];
        const playingIndex = withoutItem.findIndex(
          (track) => track.id === currentTrack.id,
        );
        const insertAt = playingIndex < 0 ? 0 : playingIndex + 1;
        return [
          ...withoutItem.slice(0, insertAt),
          item,
          ...withoutItem.slice(insertAt),
        ];
      });
      setMessage(action === "next" ? "Playing next." : "Added to the queue.");
      return;
    }
    if (action === "radio") return startRadio(item);
    if (action === "favorite") return toggleLike(getTrackVideoId(item));
    if (action === "album" && item.album)
      return navigate("albums", {
        album: { id: item.album.id, title: item.album.name, ...item.album },
      });
    if (action === "artist" && item.artists?.[0])
      return navigate("artists", {
        artist: { ...item.artists[0], title: item.artists[0].name },
      });
    if (action === "playlist") {
      try {
        const result = await window.api.yt.addToPlaylist({
          playlistId: payload.id,
          videoIds: [item.videoId || item.id],
        });
        if (!result?.ok) throw new Error(result?.error);
        setMessage(`Added to ${payload.title}.`);
      } catch {
        setMessage("This song couldn’t be added to the playlist.");
      }
      return;
    }
    if (action === "copy") {
      const link =
        item.homepage ||
        item.streamUrl ||
        `https://music.youtube.com/watch?v=${item.videoId || item.id}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      setMessage("Link copied.");
      return;
    }
    if (action === "download") {
      setMessage(`Downloading “${item.title}”…`);
      try {
        const stream = await window.api.yt.getSongStream(
          item.videoId || item.id,
          preferences.downloadQuality,
        );
        if (!stream?.streamUrl) throw new Error(stream?.error);
        const result = await window.api.yt.downloadSong({
          streamUrl: stream.streamUrl,
          title: item.title,
          artist: getArtistName(item),
          container: stream.format?.container,
          contentType: stream.format?.codec,
          contentLength: stream.format?.contentLength,
        });
        if (!result?.ok) throw new Error(result?.error);
        setMessage("Download complete. Saved to Music\\iTune.");
      } catch (error) {
        setMessage(error?.message || "This song couldn’t be downloaded.");
      }
    }
  };
  const toggleShuffle = () => {
    if (isShuffle) {
      const index = originalQueue.current.findIndex(
        (track) => track.id === currentTrack?.id,
      );
      if (index >= 0) {
        setQueue(originalQueue.current);
        setCurrentIndex(index);
      }
    } else {
      setQueue((previous) => [
        ...previous.slice(0, currentIndex + 1),
        ...shuffledCopy(previous.slice(currentIndex + 1)),
      ]);
    }
    setIsShuffle((value) => !value);
  };
  const toggleEndlessQueue = () =>
    setEndlessQueueEnabled((enabled) => !enabled);

  useEffect(() => {
    if (
      !endlessQueueEnabled ||
      currentTrack?.type === "radio" ||
      !queue.length ||
      currentIndex < queue.length - 4
    )
      return;
    extendRelatedQueue(currentTrack, queueGeneration.current);
  }, [
    currentIndex,
    currentTrack?.id,
    currentTrack?.type,
    endlessQueueEnabled,
    extendRelatedQueue,
    queue,
  ]);

  const next = useCallback(
    async (ended = false) => {
      const shared = listenTogetherRef.current;
      if (
        !ended &&
        shared?.mode === "lan" &&
        shared.role === "guest"
      ) {
        window.api.ishare
          .lanAction(
            shared.hostAddress,
            shared.session.participantId,
            "next",
            {},
          )
          .catch(() => {});
        return false;
      }
      let activeQueue = queueRef.current;
      let activeIndex = currentIndexRef.current;
      if (!activeQueue.length) return false;
      if (ended && !preferences.autoplay && repeatMode === "off") {
        setIsPlaying(false);
        return false;
      }
      let index = activeIndex + 1;
      if (index >= activeQueue.length && endlessQueueEnabled) {
        activeQueue = await extendRelatedQueue(
          currentTrackRef.current,
          queueGeneration.current,
        );
      }
      if (index >= activeQueue.length) {
        if (repeatMode === "all") index = 0;
        else {
          if (ended) setIsPlaying(false);
          return false;
        }
      }
      const previousTrackId = currentTrackRef.current?.id;
      player.current?.preparePlayback(true);
      currentIndexRef.current = index;
      currentTrackRef.current = activeQueue[index];
      setCurrentIndex(index);
      if (activeQueue[index]?.id === previousTrackId)
        player.current?.restart();
      else setCurrentTrack(activeQueue[index]);
      return true;
    },
    [
      endlessQueueEnabled,
      extendRelatedQueue,
      repeatMode,
      preferences.autoplay,
    ],
  );
  const previous = useCallback(() => {
    const shared = listenTogetherRef.current;
    if (shared?.mode === "lan" && shared.role === "guest") {
      window.api.ishare
        .lanAction(
          shared.hostAddress,
          shared.session.participantId,
          "previous",
          {},
        )
        .catch(() => {});
      return;
    }
    if (playbackRef.current.currentTime > 3 || currentIndex <= 0) {
      player.current?.restart();
      return;
    }
    player.current?.preparePlayback(true);
    setCurrentIndex(currentIndex - 1);
    setCurrentTrack(queue[currentIndex - 1]);
  }, [queue, currentIndex]);

  const buildSharedState = useCallback(() => {
    const track = currentTrackRef.current;
    const snapshot = playbackRef.current;
    const activeQueue = queueRef.current;
    const queueStart = Math.max(0, currentIndexRef.current);
    return {
      songId: track?.videoId || track?.id || "",
      title: track?.title || "",
      artists: track ? [getArtistName(track)] : [],
      thumbnailUrl: track?.thumbnail || "",
      positionMs: Math.round((snapshot.currentTime || 0) * 1000),
      isPlaying: Boolean(isPlayingRef.current),
      durationMs: Math.round(
        (snapshot.duration || track?.durationSeconds || 0) * 1000,
      ),
      updatedAt: Date.now(),
      settings: ishareSettings,
      queue: activeQueue.slice(queueStart, queueStart + 18).map((item) => ({
        id: item.videoId || item.id,
        title: item.title || "Unknown Song",
        artist: getArtistName(item),
        thumbnailUrl: item.thumbnail || "",
        durationMs: Math.round((item.durationSeconds || 0) * 1000),
      })),
      totalQueueSize: Math.max(0, activeQueue.length - queueStart),
    };
  }, [ishareSettings]);

  const applySharedSession = useCallback((sessionData) => {
    const state = sessionData?.state;
    if (!state?.songId) return;
    const sessionQueue = state.queue?.length
      ? state.queue
      : sessionData.queue || [];
    const importedQueue = mergeUniqueTracks(
      sessionQueue.map(sharedQueueTrack).filter(Boolean),
      [
        sharedQueueTrack({
          id: state.songId,
          title: state.title,
          artist: (state.artists || []).filter(
            (artist) => !String(artist).startsWith("__AB_"),
          )[0],
          thumbnailUrl: String(state.thumbnailUrl || "").split("#")[0],
          durationMs: state.durationMs,
        }),
      ].filter(Boolean),
    );
    const remoteTrack =
      importedQueue.find((item) => item.id === state.songId) ||
      sharedQueueTrack({
        id: state.songId,
        title: state.title,
        artist: (state.artists || [])[0],
        thumbnailUrl: String(state.thumbnailUrl || "").split("#")[0],
        durationMs: state.durationMs,
      });
    if (!remoteTrack) return;
    const orderedQueue = mergeUniqueTracks([remoteTrack], importedQueue);
    const remoteIndex = orderedQueue.findIndex(
      (item) => item.id === remoteTrack.id,
    );
    const elapsedMs = state.isPlaying
      ? Math.max(0, (sessionData.serverNow || Date.now()) - state.updatedAt)
      : 0;
    const targetSeconds = Math.max(0, (state.positionMs + elapsedMs) / 1000);
    const changedTrack = currentTrackRef.current?.id !== remoteTrack.id;

    if (changedTrack) {
      player.current?.preparePlayback(state.isPlaying);
      ++queueGeneration.current;
      queueRequests.current.clear();
      fetchedQueueSeeds.current.clear();
      queueRef.current = orderedQueue;
      currentIndexRef.current = remoteIndex;
      currentTrackRef.current = remoteTrack;
      originalQueue.current = orderedQueue;
      setQueue(orderedQueue);
      setCurrentIndex(remoteIndex);
      setCurrentTrack(remoteTrack);
    }

    const applyTransport = () => {
      const localTime = playbackRef.current.currentTime || 0;
      if (changedTrack || Math.abs(localTime - targetSeconds) > 1.8)
        player.current?.seek(targetSeconds);
      if (state.isPlaying) player.current?.play();
      else player.current?.pause();
    };
    if (changedTrack) setTimeout(applyTransport, 650);
    else applyTransport();
  }, []);

  const createListenTogether = async (displayName) => {
    setListenBusy(true);
    setListenError("");
    try {
      const result = await window.api.ishare.create(
        displayName,
        buildSharedState(),
      );
      if (!result?.ok || !result.session) throw new Error(result?.error);
      setListenTogether({
        role: "host",
        mode: "online",
        displayName,
        session: result.session,
      });
    } catch (failure) {
      setListenError(
        failure.message || "Couldn’t start a Listen Together session.",
      );
    } finally {
      setListenBusy(false);
    }
  };

  const joinListenTogether = async (code, displayName) => {
    setListenBusy(true);
    setListenError("");
    try {
      const result = await window.api.ishare.join(code, displayName);
      if (!result?.ok || !result.session) throw new Error(result?.error);
      setIshareSettings(
        result.session.state?.settings ||
          result.session.settings ||
          ishareSettings,
      );
      setListenTogether({
        role: "guest",
        mode: "online",
        displayName,
        session: result.session,
      });
      applySharedSession(result.session);
    } catch (failure) {
      setListenError(
        failure.message || "Couldn’t join that Listen Together session.",
      );
    } finally {
      setListenBusy(false);
    }
  };

  const hostLanListenTogether = async (displayName) => {
    setListenBusy(true);
    setListenError("");
    try {
      const result = await window.api.ishare.lanStart({
        displayName,
        state: buildSharedState(),
        settings: ishareSettings,
        port: 8765,
      });
      if (!result?.ok || !result.session) throw new Error(result?.error);
      const hostAddress = result.session.code;
      setLocalLanIp(hostAddress.split(":")[0]);
      setListenTogether({
        role: "host",
        mode: "lan",
        hostAddress,
        displayName,
        session: result.session,
      });
    } catch (failure) {
      setListenError(failure.message || "Couldn’t start LAN hosting.");
    } finally {
      setListenBusy(false);
    }
  };

  const scanLanHosts = async () => {
    setScanningLan(true);
    setListenError("");
    try {
      const result = await window.api.ishare.lanScan();
      if (!result?.ok) throw new Error(result?.error);
      setLanHosts(result.hosts || []);
      setLocalLanIp(result.localIp || "");
      if (!result.hosts?.length)
        setListenError("No AirBeats or iShare hosts were found on this network.");
    } catch (failure) {
      setListenError(failure.message || "The local network scan failed.");
    } finally {
      setScanningLan(false);
    }
  };

  const joinLanListenTogether = async (address, displayName) => {
    setListenBusy(true);
    setListenError("");
    try {
      const result = await window.api.ishare.lanJoin(address, displayName);
      if (!result?.ok || !result.session) throw new Error(result?.error);
      setIshareSettings(
        result.session.state?.settings ||
          result.session.settings ||
          ishareSettings,
      );
      setListenTogether({
        role: "guest",
        mode: "lan",
        hostAddress: result.address,
        displayName,
        session: result.session,
      });
      applySharedSession(result.session);
    } catch (failure) {
      setListenError(failure.message || "Couldn’t join that LAN host.");
    } finally {
      setListenBusy(false);
    }
  };

  const leaveListenTogether = async () => {
    const active = listenTogether;
    setListenBusy(true);
    if (active?.mode === "lan" && active.role === "host") {
      await window.api.ishare.lanStop().catch(() => {});
    } else if (active?.mode === "lan" && active.hostAddress) {
      await window.api.ishare
        .lanLeave(active.hostAddress, active.session.participantId)
        .catch(() => {});
    } else if (active?.session?.code && active.session.participantId) {
      await window.api.ishare
        .leave(active.session.code, active.session.participantId)
        .catch(() => {});
    }
    setListenTogether(null);
    setListenBusy(false);
    setListenError("");
  };

  const applyLanHostActions = useCallback(
    (actions = []) => {
      actions.forEach(({ action, positionMs, extraData }) => {
        if (action === "play" || action === "resume") player.current?.play();
        else if (action === "pause") player.current?.pause();
        else if (action === "toggle_play_pause") player.current?.togglePlay();
        else if (action === "seek" && Number.isFinite(Number(positionMs)))
          player.current?.seek(Number(positionMs) / 1000);
        else if (action === "next") next();
        else if (action === "previous") previous();
        else if (
          (action === "add_to_queue" || action === "play_next") &&
          extraData?.track
        ) {
          const added = sharedQueueTrack(extraData.track);
          if (!added) return;
          setQueue((previousQueue) => {
            const without = previousQueue.filter((item) => item.id !== added.id);
            if (action === "add_to_queue") return [...without, added];
            const insertAt = Math.max(0, currentIndexRef.current + 1);
            return [
              ...without.slice(0, insertAt),
              added,
              ...without.slice(insertAt),
            ];
          });
        }
      });
    },
    [next, previous],
  );

  const handleSharedPlaybackAction = useCallback(
    (action, payload = {}) => {
      const active = listenTogetherRef.current;
      if (active?.mode !== "lan" || active.role !== "guest") return;
      window.api.ishare
        .lanAction(
          active.hostAddress,
          active.session.participantId,
          action,
          payload,
        )
        .then((result) => {
          if (result?.ok === false)
            setListenError(result.error || "The host blocked that control.");
        })
        .catch(() => {});
    },
    [],
  );

  useEffect(() => {
    const active = listenTogether;
    if (!active?.session?.code) return;
    let mounted = true;
    let timer;
    const sync = async () => {
      try {
        let result;
        if (active.mode === "lan") {
          result =
            active.role === "host"
              ? await window.api.ishare.lanUpdate(
                  buildSharedState(),
                  ishareSettings,
                )
              : await window.api.ishare.lanGet(
                  active.hostAddress,
                  active.session.participantId,
                );
        } else {
          result =
            active.role === "host"
              ? await window.api.ishare.update(
                  active.session.code,
                  active.session.participantId,
                  buildSharedState(),
                )
              : await window.api.ishare.get(active.session.code);
        }
        if (!mounted) return;
        if (!result?.ok || !result.session)
          throw new Error(result?.error || "Session update failed.");
        setListenError("");
        setListenTogether((previous) =>
          previous ? { ...previous, session: result.session } : previous,
        );
        if (active.mode === "lan" && active.role === "host")
          applyLanHostActions(result.actions || []);
        if (active.role === "guest") {
          const nextSettings =
            result.session.state?.settings || result.session.settings;
          if (nextSettings)
            setIshareSettings((previous) =>
              previous.allowGuestsToControlPlayback ===
                  nextSettings.allowGuestsToControlPlayback &&
                previous.allowGuestsToAddTracks ===
                  nextSettings.allowGuestsToAddTracks
                ? previous
                : nextSettings,
            );
          applySharedSession(result.session);
        }
      } catch (failure) {
        if (mounted)
          setListenError(
            failure.message || "Listen Together is reconnecting…",
          );
      } finally {
        if (mounted)
          timer = setTimeout(sync, active.role === "host" ? 1400 : 1100);
      }
    };
    timer = setTimeout(sync, 350);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [
    applySharedSession,
    applyLanHostActions,
    buildSharedState,
    ishareSettings,
    listenTogether?.role,
    listenTogether?.mode,
    listenTogether?.hostAddress,
    listenTogether?.session?.code,
    listenTogether?.session?.participantId,
  ]);
  useEffect(() => {
    const onKey = (event) => {
      const editing = event.target.closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowLyrics(false);
        navigate("search");
      }
      if (
        !editing &&
        event.code === "Space" &&
        event.target.tagName !== "BUTTON"
      ) {
        event.preventDefault();
        player.current?.togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const trackProps = {
    onSelectTrack: selectTrack,
    currentTrack,
    isPlaying,
    likedSongIds,
    onToggleLike: toggleLike,
    onContextMenu: openContextMenu,
  };
  const appUserProfile = {
    ...userProfile,
    name:
      (userProfile.isLoggedIn ? userProfile.name : preferredName) ||
      userProfile.name ||
      "Listener",
  };
  const accountProps = { userProfile: appUserProfile, onLogin: login };
  const collectionAtmosphere =
    preferences.collectionVisualEffects && sceneArtwork?.heroUrl;
  return (
    <div
      className={`app-container ${collectionAtmosphere ? "collection-atmosphere-active" : ""}`}
      onContextMenu={(event) => {
        if (!event.defaultPrevented) openContextMenu(event);
      }}
    >
      <ArtworkBackdrop
        src={
          collectionAtmosphere
            ? sceneArtwork.heroUrl
            : !preferences.desktopTransparency && preferences.backgroundArtwork
              ? currentTrack?.thumbnail || homeArtwork
              : null
        }
        canvas={
          collectionAtmosphere
            ? sceneArtwork?.videoUrl
            : trackArtwork?.videoUrl
        }
        className={collectionAtmosphere ? "collection-atmosphere" : ""}
      />
      <div
        className="desktop-titlebar"
        onDoubleClick={() => window.api.window?.maximize?.()}
      >
        <div className="mac-window-controls" aria-label="Window controls">
          <button
            className="mac-window-button close"
            aria-label="Close"
            onClick={() => window.api.window?.close?.()}
          />
          <button
            className="mac-window-button minimize"
            aria-label="Minimize"
            onClick={() => window.api.window?.minimize?.()}
          />
          <button
            className="mac-window-button fullscreen"
            aria-label="Enter or exit full screen"
            onClick={() => window.api.window?.fullscreen?.()}
          />
        </div>
        <span className="desktop-title">iTune</span>
        <div className="titlebar-balance" aria-hidden="true" />
      </div>
      <div className="app-shell">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={navigate}
          userProfile={appUserProfile}
          authLoading={authLoading}
          onLogin={login}
          onLogout={logout}
        />
        <div className="workspace">
          <Player
            ref={player}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onNext={next}
            onPrevious={previous}
            onOpenLyrics={() => {
              setLyricsCompact(true);
              setShowLyrics((value) => !value);
              setShowQueue(false);
            }}
            isLiked={likedSongIds.has(getTrackVideoId(currentTrack))}
            onToggleLike={() => toggleLike(getTrackVideoId(currentTrack))}
            isShuffle={isShuffle}
            onToggleShuffle={toggleShuffle}
            repeatMode={repeatMode}
            onToggleRepeat={() =>
              setRepeatMode((value) =>
                value === "off" ? "all" : value === "all" ? "one" : "off",
              )
            }
            endlessQueueEnabled={endlessQueueEnabled}
            onToggleEndlessQueue={toggleEndlessQueue}
            onToggleQueue={() => setShowQueue((value) => !value)}
            showQueue={showQueue}
            showLyrics={showLyrics}
            showListenTogether={showListenTogether}
            listenTogetherActive={Boolean(listenTogether)}
            onToggleListenTogether={() => {
              setShowListenTogether((value) => !value);
              setShowQueue(false);
            }}
            onPlaybackChange={updatePlayback}
            onUserPlaybackAction={handleSharedPlaybackAction}
          />
          <div className="content-toolbar">
            <div>
              <button
                className="icon-button"
                aria-label="Go back"
                disabled={navigation.index === 0}
                onClick={() =>
                  setNavigation((previous) => ({
                    ...previous,
                    index: previous.index - 1,
                  }))
                }
              >
                <ChevronLeft size={21} />
              </button>
              <button
                className="icon-button"
                aria-label="Go forward"
                disabled={navigation.index === navigation.entries.length - 1}
                onClick={() =>
                  setNavigation((previous) => ({
                    ...previous,
                    index: previous.index + 1,
                  }))
                }
              >
                <ChevronRight size={21} />
              </button>
            </div>
            <span>{tabLabels[activeTab]}</span>
          </div>
          <div className="content-with-queue">
            <main className="content-area" ref={content}>
              <div
                className="view-transition"
                key={`${activeTab}-${view.artist?.id || view.album?.id || view.playlist?.id || ""}`}
              >
                {["home", "new"].includes(activeTab) && (
                  <DiscoveryView
                    kind={activeTab}
                    {...accountProps}
                    {...trackProps}
                    onNavigate={navigate}
                    onStartRadio={startRadio}
                    onBackdropChange={setHomeArtwork}
                  />
                )}
                {activeTab === "radio" && (
                  <RadioView {...trackProps} />
                )}
                {activeTab === "news" && (
                  <DeveloperNewsView
                    feed={developerNews}
                    initialItemKey={view.newsItemKey}
                  />
                )}
                {activeTab === "search" && (
                  <SearchView {...trackProps} {...accountProps} />
                )}
                {activeTab === "playlists" && (
                  <PlaylistView
                    {...accountProps}
                    {...trackProps}
                    initialPlaylist={view.playlist}
                    onShuffleTracks={shuffleTracks}
                    onArtworkChange={setSceneArtwork}
                  />
                )}
                {activeTab === "artists" && (
                  <ArtistsView
                    {...accountProps}
                    {...trackProps}
                    initialArtist={view.artist}
                    onShuffleTracks={shuffleTracks}
                    onArtworkChange={setSceneArtwork}
                  />
                )}
                {["albums", "songs", "favorites"].includes(activeTab) && (
                  <LibraryView
                    mode={activeTab}
                    {...accountProps}
                    {...trackProps}
                    initialAlbum={view.album}
                    onShuffleTracks={shuffleTracks}
                    onArtworkChange={setSceneArtwork}
                  />
                )}
                {activeTab === "history" && (
                  <HistoryView {...accountProps} {...trackProps} />
                )}
                {activeTab === "settings" && (
                  <SettingsView
                    {...accountProps}
                    onLogout={logout}
                    onOpenNews={() => navigate("news")}
                    onShowAbout={() => setShowAbout(true)}
                  />
                )}
              </div>
            </main>
            <AnimatedPresence show={showQueue} className="presence-queue">
              <QueuePanel
                queue={queue}
                currentIndex={currentIndex}
                onSelect={selectTrack}
                onClose={() => setShowQueue(false)}
                isShuffle={isShuffle}
                onToggleShuffle={toggleShuffle}
                endlessQueueEnabled={endlessQueueEnabled}
                onToggleEndlessQueue={toggleEndlessQueue}
                repeatMode={repeatMode}
                onToggleRepeat={() =>
                  setRepeatMode((value) =>
                    value === "off"
                      ? "all"
                      : value === "all"
                        ? "one"
                        : "off",
                  )
                }
              />
            </AnimatedPresence>
          </div>
        </div>
      </div>
      <AnimatedPresence
        show={Boolean(showLyrics && currentTrack)}
        duration={320}
        className="presence-lyrics"
      >
        <LyricsModal
          track={currentTrack}
          onClose={() => setShowLyrics(false)}
          playback={playback}
          isPlaying={isPlaying}
          onTogglePlay={() => player.current?.togglePlay()}
          onNext={next}
          onPrevious={previous}
          onSeek={(time) => player.current?.seek(time)}
          compact={lyricsCompact}
          onToggleCompact={() => setLyricsCompact((value) => !value)}
          canvasUrl={trackArtwork?.videoUrl}
          isShuffle={isShuffle}
          onToggleShuffle={toggleShuffle}
          repeatMode={repeatMode}
          onToggleRepeat={() =>
            setRepeatMode((value) =>
              value === "off" ? "all" : value === "all" ? "one" : "off",
            )
          }
          onVolumeChange={(value) => player.current?.setVolume(value)}
        />
