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
