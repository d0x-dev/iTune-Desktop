import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MapPin,
  Play,
  Radio,
  RefreshCw,
  Search,
  Signal,
} from "lucide-react";
import Artwork from "./Artwork";
import FavoriteIcon from "./FavoriteIcon";

const FAVORITES_KEY = "itune-radio-favorites";

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function RadioView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  onContextMenu,
}) {
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState(
    () => localStorage.getItem("itune-radio-country") || "IN",
  );
  const [query, setQuery] = useState("");
