import React, { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, Clock } from "lucide-react";
import TrackList from "./TrackList";
import MediaShelf from "./MediaShelf";
import AnimatedPresence from "./AnimatedPresence";

export default function SearchView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  likedSongIds,
  onToggleLike,
  userProfile,
  onLogin,
  onContextMenu,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [scope, setScope] = useState("catalog");
  const categories = [
    ["Apple Music Live", "card_apple_music_live", "Apple Music live"],
    ["Hits", "card_hits", "top hits"],
    ["Alternative", "card_alternative", "alternative"],
    ["Pop", "card_pop", "pop"],
    ["Hip-Hop", "card_hip_hop", "hip hop"],
    ["Country", "card_country", "country"],
    ["Dance", "card_dance", "dance"],
    ["Rock", "card_rock", "rock"],
    ["Latin", "card_latin", "latin"],
    ["R&B", "card_rnb", "R&B"],
    ["Classical", "browse_classical", "classical"],
    ["Spatial Audio", "browse_spatial_audio", "spatial audio"],
  ];
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const container = useRef(null);
  const input = useRef(null);
  const searchRevision = useRef(0);
  const filters = [
    { id: "", label: "All" },
    { id: "song", label: "Songs" },
    { id: "album", label: "Albums" },
    { id: "artist", label: "Artists" },
    { id: "playlist", label: "Playlists" },
    { id: "video", label: "Music Videos" },
  ];

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(
      () =>
        window.api.yt
          .getSearchSuggestions(query)
          .then((data) => {
            if (active) setSuggestions(data?.suggestions || []);
          })
          .catch(() => {
            if (active) setSuggestions([]);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);
  useEffect(() => {
    const close = (event) => {
      if (!container.current?.contains(event.target)) setShowSuggestions(false);
    };
    document.addEventListener("pointerdown", close);
    return () => {
      searchRevision.current++;
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  const search = async (value = query, type = filter, searchScope = scope) => {
    if (!value.trim()) return;
    const revision = ++searchRevision.current;
    setSubmittedQuery(value.trim());
    setShowSuggestions(false);
    setLoading(true);
    setSearched(true);
    setError("");
    try {
      let data;
      if (searchScope === "library") {
        if (!userProfile?.isLoggedIn) {
          onLogin?.();
          setLoading(false);
          return;
        }
        const responses = await Promise.all([
          window.api.yt.getSongs(),
          window.api.yt.getAlbums(),
          window.api.yt.getPlaylists(),
          window.api.yt.getSubscribedArtists(),
        ]);
        const library = [
          ...(responses[0]?.tracks || []),
          ...(responses[1]?.albums || []),
          ...(responses[2]?.playlists || []).map((item) => ({
            ...item,
            type: "playlist",
          })),
          ...(responses[3]?.artists || []).map((item) => ({
            ...item,
            title: item.name,
            type: "artist",
          })),
        ];
        data = {
          results: library.filter(
            (item) =>
              `${item.title} ${item.name || ""} ${item.artists?.map((artist) => artist.name).join(" ") || ""}`
                .toLowerCase()
                .includes(value.trim().toLowerCase()) &&
              (!type || item.type === type),
          ),
        };
      } else data = await window.api.yt.search(value.trim(), type || undefined);
      if (searchRevision.current !== revision) return;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results || []);
    } catch (failure) {
      if (searchRevision.current === revision) {
        setError(failure.message || "Search couldn’t load. Try again.");
        setResults([]);
      }
    } finally {
      if (searchRevision.current === revision) setLoading(false);
    }
  };
  const collections = results.filter(
    (item) =>
      /album|artist|playlist/i.test(item.type || "") ||
      /^(MPRE|VL|PL|RD|UC|OLAK)/.test(item.id || ""),
  );
  const songs = results.filter((item) => !collections.includes(item));
  return (
    <div className="page search-page">
      <header className="page-heading">
        <h1>Search</h1>
        <p>Find your next favorite song.</p>
      </header>
      <div className="search-scope" aria-label="Search scope">
        <button
          className={scope === "catalog" ? "active" : ""}
          onClick={() => {
            setScope("catalog");
            if (query.trim()) search(query, filter, "catalog");
          }}
        >
          YouTube Music
        </button>
        <button
          className={scope === "library" ? "active" : ""}
          onClick={() => {
            setScope("library");
            if (query.trim()) search(query, filter, "library");
          }}
        >
          Your Library
        </button>
      </div>
      <div className="search-form" ref={container}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
        >
          <div className="search-input-wrap">
            <Search size={19} />
            <input
              ref={input}
              autoFocus
              aria-label="Search music"
              placeholder="Artists, songs, albums, and more"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowSuggestions(false);
              }}
              autoComplete="off"
            />
            {query && (
              <button
                className="icon-button"
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  searchRevision.current++;
