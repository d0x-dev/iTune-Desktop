import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Sparkles,
  Loader2,
  Compass,
  ChevronLeft,
  ChevronRight,
  Flame,
  Radio,
  Music,
} from 'lucide-react';
import { getArtistName } from '../utils/format';

function HomeShelf({ section, onSelectTrack }) {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -600, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 600, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col gap-3.5 group/shelf">
      {/* Shelf Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          {section.title.toLowerCase().includes('listen') ? (
            <Flame className="w-5 h-5 text-[#fa2d48]" />
          ) : section.title.toLowerCase().includes('quick') ? (
            <Radio className="w-5 h-5 text-[#fa2d48]" />
          ) : (
            <Compass className="w-5 h-5 text-[#fa2d48]" />
          )}
          {section.title}
        </h3>

        {/* Scroll Arrows */}
        <div className="flex items-center gap-1.5 opacity-60 group-hover/shelf:opacity-100 transition-opacity">
          <button
            onClick={scrollLeft}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-neutral-300 hover:text-white flex items-center justify-center transition-all border border-white/5"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-neutral-300 hover:text-white flex items-center justify-center transition-all border border-white/5"
            title="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-3 pt-1 -mx-1 px-1"
      >
        {section.contents.map((item, idx) => (
          <div
            key={item.id || idx}
            onClick={() => onSelectTrack(item, section.contents)}
            className="glass-card group p-3 flex flex-col gap-2.5 cursor-pointer relative w-44 sm:w-48 flex-shrink-0 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#fa2d48]/10"
          >
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-800 relative shadow-md">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                  <Play className="w-8 h-8 text-neutral-600" />
                </div>
              )}
              <button className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#fa2d48] text-white flex items-center justify-center shadow-lg shadow-[#fa2d48]/40 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate group-hover:text-[#fa2d48] transition-colors">
                {item.title}
              </span>
              <span className="text-xs text-neutral-400 truncate mt-0.5">
                {getArtistName(item)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeView({ onSelectTrack, userProfile, authLoading, onLogin }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMood, setActiveMood] = useState('All');

  const moods = ['All', 'Relax', 'Energize', 'Workout', 'Focus', 'Commute'];

  useEffect(() => {
    async function loadHome() {
      setLoading(true);
      try {
        const data = await window.api.yt.getHome();
        if (data?.sections) {
          setSections(data.sections);
        }
      } catch (err) {
        console.error('Failed to load home feed:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHome();
  }, [userProfile?.isLoggedIn]);

  // Filter sections if a mood is active
  const filteredSections =
    activeMood === 'All'
      ? sections
      : sections.filter((s) =>
          s.title.toLowerCase().includes(activeMood.toLowerCase())
        );

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-[#fa2d48]/20 border border-white/5 shadow-2xl">
        <div className="relative z-10 max-w-xl flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#fa586a] text-xs font-semibold backdrop-blur-md w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            YouTube Music InnerTube Engine
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {authLoading
              ? 'Connecting Account...'
              : userProfile?.isLoggedIn
              ? `Welcome back, ${userProfile.name}`
              : 'Listen Without Boundaries'}
          </h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {authLoading
              ? 'Checking your Google YouTube Music credentials...'
              : userProfile?.isLoggedIn
              ? 'Your personalized playlists, listening history, and full home feed are connected.'
              : 'Sign in with your Google account to automatically load your playlists and sync history without any browser extension.'}
          </p>
          {!authLoading && !userProfile?.isLoggedIn && (
            <div className="pt-2">
              <button
                onClick={onLogin}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-white text-neutral-950 hover:bg-neutral-100 transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mood & Activity Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {moods.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMood(m)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeMood === m
                ? 'bg-[#fa2d48] text-white shadow-md shadow-[#fa2d48]/30'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Shelves Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
          <span className="text-xs">Fetching complete home feed from YouTube Music...</span>
        </div>
      ) : filteredSections.length > 0 ? (
        <div className="flex flex-col gap-9">
          {filteredSections.map((section, sIdx) => (
            <HomeShelf
              key={sIdx}
              section={section}
              onSelectTrack={onSelectTrack}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No recommendations found for "{activeMood}". Try switching back to "All"!
        </div>
      )}
    </div>
  );
}
