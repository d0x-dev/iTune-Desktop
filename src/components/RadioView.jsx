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
      setHasMore(Boolean(result?.hasMore));
    } catch (failure) {
      if (requestRevision === revision.current)
        setError(failure.message || "Online radio couldn’t load.");
    } finally {
      if (requestRevision === revision.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem("itune-radio-country", countryCode);
    const timeout = setTimeout(() => loadStations(), query ? 350 : 0);
    return () => clearTimeout(timeout);
  }, [countryCode, query]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((station) => station.id)),
    [favorites],
  );
  const visibleStations = favoritesOnly ? favorites : stations;
  const toggleFavorite = (station) => {
    const next = favoriteIds.has(station.id)
      ? favorites.filter((item) => item.id !== station.id)
      : [station, ...favorites];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };
  const playStation = (station) => {
    window.api.radio.recordClick(station.uuid).catch(() => {});
    onSelectTrack(station, visibleStations);
  };

  return (
    <div className="page online-radio-page">
      <header className="page-heading radio-heading">
        <div>
          <h1>Radio</h1>
          <p>Live stations from around the world.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Refresh radio stations"
          onClick={() => loadStations()}
        >
          <RefreshCw size={17} />
        </button>
      </header>

      <div className="radio-toolbar">
        <label className="radio-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search live stations"
            aria-label="Search live radio"
          />
        </label>
        <label className="radio-country">
          <MapPin size={16} />
          <select
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            aria-label="Radio country"
          >
            {countries.map((country) => (
