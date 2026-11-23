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
