import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Clock, ArrowUpRight, Music2 } from 'lucide-react';
import TrackList from './TrackList';

export default function SearchView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  likedSongIds,
  onToggleLike,
}) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(''); // '' | 'song' | 'video' | 'album' | 'playlist'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Suggestions & History State
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const filters = [
    { id: '', label: 'All' },
    { id: 'song', label: 'Songs' },
    { id: 'video', label: 'Music Videos' },
    { id: 'album', label: 'Albums' },
    { id: 'playlist', label: 'Playlists' },
  ];

  // Fetch suggestions or history from YouTube Music
  const fetchSuggestions = async (searchTerm) => {
    try {
      setLoadingSuggestions(true);
      const res = await window.api.yt.getSearchSuggestions(searchTerm || '');
      setSuggestions(res?.suggestions || []);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Input Change with Debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 200);
  };

  // Handle Focus: If empty, show account search history
  const handleFocus = () => {
    setShowDropdown(true);
    fetchSuggestions(query);
  };

  const executeSearch = async (searchQuery, filterType = activeFilter) => {
    const q = (searchQuery !== undefined ? searchQuery : query).trim();
    if (!q) return;

    setShowDropdown(false);
    setLoading(true);
    setSearched(true);
    try {
      const data = await window.api.yt.search(q, filterType || undefined);
      setResults(data?.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (item) => {
    const text = item.text;
    setQuery(text);
    executeSearch(text);
  };

  const handleFilterClick = (filterId) => {
    setActiveFilter(filterId);
    if (query.trim()) {
      executeSearch(query.trim(), filterId);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Search Input Bar & Floating Suggestions Dropdown */}
      <div ref={containerRef} className="relative w-full max-w-2xl z-30">
        <form onSubmit={handleFormSubmit} className="relative w-full">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder="Search YouTube Music (artists, songs, albums)..."
              className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder-neutral-400 text-sm focus:outline-none focus:border-[#fa2d48] focus:ring-2 focus:ring-[#fa2d48]/20 transition-all shadow-inner"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                  fetchSuggestions('');
                }}
                className="absolute right-4 text-neutral-400 hover:text-white"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Floating Dropdown: Real-Time Suggestions & Search History */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#121318]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-white/[0.04]">
            <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
              <span>{query.trim() ? 'Suggestions' : 'Recent YouTube Searches'}</span>
              {loadingSuggestions && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#fa2d48]" />}
            </div>

            <div className="max-h-80 overflow-y-auto py-1">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionClick(item)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-neutral-200 hover:bg-white/10 hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.isHistory ? (
                      <Clock className="w-4 h-4 text-[#fa2d48] flex-shrink-0" />
                    ) : (
                      <Search className="w-4 h-4 text-neutral-400 flex-shrink-0 group-hover:text-white" />
                    )}
                    <span className="truncate">{item.text}</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 z-10">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => handleFilterClick(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeFilter === f.id
                ? 'bg-[#fa2d48] text-white shadow-md shadow-[#fa2d48]/30'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
          <span className="text-xs">Searching YouTube Music...</span>
        </div>
      ) : searched && results.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight">Top Results</h3>
            <span className="text-xs text-neutral-400">{results.length} results</span>
          </div>
          <TrackList
            tracks={results}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={onSelectTrack}
            likedSongIds={likedSongIds}
            onToggleLike={onToggleLike}
          />
        </div>
      ) : searched ? (
        <div className="py-20 text-center text-neutral-500 text-sm">
          No matches found for "{query}". Try another query.
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-center gap-3 text-neutral-500">
          <Search className="w-10 h-10 stroke-[1.5] text-neutral-600" />
          <p className="text-sm font-medium">Search across millions of songs, albums, and playlists on YouTube Music</p>
        </div>
      )}
    </div>
  );
}
