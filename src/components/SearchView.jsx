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
