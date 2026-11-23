import React, { useEffect, useState } from "react";
import AndroidIcon from "./AndroidIcon";
import Artwork from "./Artwork";
import FestivalBrand from "./FestivalBrand";
import AnimatedPresence from "./AnimatedPresence";
import {
  Home,
  Search,
  Library,
  LogOut,
  Music2,
  Disc3,
  Loader2,
  Users,
  X,
  Clock3,
  Newspaper,
} from "lucide-react";

const GOOGLE_LOGO = `${import.meta.env.BASE_URL}android-icons/ic_google_logo.svg`;

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
  authLoading,
  onLogin,
  onLogout,
}) {
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  useEffect(() => {
    let active = true;
    if (!userProfile?.isLoggedIn) {
      setPlaylists([]);
      return;
    }
    window.api.yt
      .getPlaylists()
      .then((data) => {
        if (active) setPlaylists(data?.playlists || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userProfile?.isLoggedIn, activeTab]);
  const iconNames = {
    home: "ic_nav_home",
    new: "ic_nav_new",
    radio: "ic_nav_radio",
    news: "ic_nav_new",
    search: "ic_nav_search",
    artists: "ic_lib_artists",
    albums: "ic_lib_albums",
    songs: "ic_lib_songs",
    playlists: "ic_lib_playlists",
    favorites: "ic_star_outline",
    settings: "ic_player_tools",
  };
  const groups = [
    {
      label: "",
      items: [
        { id: "home", label: "Home", icon: Home },
        { id: "new", label: "New", icon: Home },
        { id: "radio", label: "Radio", icon: Home },
        { id: "news", label: "News from dev", icon: Newspaper },
        { id: "search", label: "Search", icon: Search },
      ],
    },
    {
      label: "Library",
      items: [
        { id: "history", label: "Recently Played", icon: Clock3 },
        { id: "artists", label: "Artists", icon: Users },
        { id: "albums", label: "Albums", icon: Disc3 },
        { id: "songs", label: "Songs", icon: Music2 },
      ],
    },
    {
      label: "Playlists",
      items: [
        { id: "playlists", label: "All Playlists", icon: Library },
        { id: "favorites", label: "Favorite Songs", icon: Music2 },
      ],
    },
  ];
  const importSession = async (event) => {
    event.preventDefault();
    if (importing || !cookieInput.trim()) return;
    setImporting(true);
    setImportStatus("");
    try {
      const result = await window.api.auth.importCookie(cookieInput.trim());
      if (!result?.ok)
        throw new Error(result?.error || "Couldn’t connect this session.");
      setShowCookieModal(false);
      setCookieInput("");
    } catch (error) {
      setImportStatus(error.message);
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <aside className="sidebar">
        <FestivalBrand />
        <button
          className="sidebar-search"
          onClick={() => setActiveTab("search")}
        >
          <Search size={14} />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {groups.map((group, index) => (
            <div className="nav-group" key={index}>
              {group.label && <h2>{group.label}</h2>}
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${activeTab === id ? "active" : ""}`}
                  aria-current={activeTab === id ? "page" : undefined}
                  onClick={() => setActiveTab(id)}
                >
                  {iconNames[id] ? (
                    <AndroidIcon
                      name={
                        id === "favorites" && activeTab === id
                          ? "ic_star_filled"
