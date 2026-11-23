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
  const [stations, setStations] = useState([]);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);

  useEffect(() => {
    window.api.radio.getCountries().then((result) => {
      if (result?.countries?.length) {
        setCountries(result.countries);
        if (!result.countries.some((item) => item.code === countryCode))
          setCountryCode(result.countries[0].code);
      }
    });
  }, []);

  const loadStations = async ({ append = false } = {}) => {
    const requestRevision = ++revision.current;
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const result = await window.api.radio.getStations({
        countryCode,
        query: query.trim(),
        offset: append ? stations.length : 0,
        limit: 48,
      });
      if (requestRevision !== revision.current) return;
      if (result?.error) throw new Error(result.error);
      setStations((previous) =>
        append ? [...previous, ...(result?.stations || [])] : result?.stations || [],
      );
