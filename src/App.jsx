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
