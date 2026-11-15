import React, { useState } from 'react';
import {
  Home,
  Search,
  Library,
  History,
  LogIn,
  LogOut,
  Music2,
  Disc3,
  Loader2,
  Users,
  KeyRound,
  X,
  Check,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
  authLoading,
  onLogin,
  onLogout,
}) {
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'playlists', label: 'Your Playlists', icon: Library },
    { id: 'artists', label: 'Subscribed Artists', icon: Users },
    { id: 'history', label: 'Listening History', icon: History },
  ];

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!cookieInput.trim()) return;
    try {
      setImportStatus('Importing session...');
      const res = await window.api.auth.importCookie(cookieInput.trim());
      if (res?.ok) {
        setImportStatus('Successfully connected!');
        setTimeout(() => {
          setShowCookieModal(false);
          setCookieInput('');
          setImportStatus(null);
        }, 800);
      } else {
        setImportStatus('Failed: ' + (res?.error || 'Invalid cookie'));
      }
    } catch (err) {
      setImportStatus('Error: ' + err.message);
    }
  };

  return (
    <>
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#fa2d48] to-[#ff6b81] flex items-center justify-center shadow-lg shadow-[#fa2d48]/20">
            <Disc3 className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              iTune <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-medium">Desktop</span>
            </h1>
            <p className="text-xs text-neutral-400">YouTube Music Client</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase px-3 mb-1">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fa2d48] to-[#fa586a] text-white shadow-md shadow-[#fa2d48]/25 font-semibold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Google Account Profile / Login Card */}
        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/5">
          {authLoading ? (
            <div className="flex items-center gap-3 py-1">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[#fa2d48]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Connecting...</p>
                <p className="text-[11px] text-neutral-400">Loading Google profile</p>
              </div>
            </div>
          ) : userProfile?.isLoggedIn ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {userProfile.photo ? (
                  <img
                    src={userProfile.photo}
                    alt={userProfile.name}
                    className="w-9 h-9 rounded-full ring-2 ring-[#fa2d48]/40 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fa2d48] to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-md">
                    {userProfile.name?.[0] || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{userProfile.name}</p>
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Google Connected
                  </p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 text-center">
              <div className="text-left">
                <p className="text-xs font-semibold text-white">Unlock Your Library</p>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  Sign in to view your personal playlists, liked songs, and listening history.
                </p>
              </div>

              <button
                onClick={onLogin}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-100 transition-all shadow-md active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign In with Google
              </button>

              <button
                onClick={() => setShowCookieModal(true)}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors underline pt-0.5"
              >
                Or paste session cookies
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Cookie Import Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#18181c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#fa2d48]/10 text-[#fa2d48] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-white">Import YouTube Music Session</h3>
              </div>
              <button
                onClick={() => {
                  setShowCookieModal(false);
                  setImportStatus(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="mt-4 flex flex-col gap-4">
              <p className="text-xs text-neutral-300 leading-relaxed">
                Paste session cookies from <code className="text-[#fa2d48] bg-white/5 px-1 rounded">music.youtube.com</code> below:
              </p>

              <textarea
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                placeholder="SAPISID=...; SSID=...; LOGIN_INFO=..."
                rows={4}
                className="w-full bg-[#101014] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#fa2d48] font-mono resize-none"
              />

              {importStatus && (
                <div className="text-xs px-3 py-2 rounded-lg bg-white/5 text-neutral-200 border border-white/10">
                  {importStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCookieModal(false);
                    setImportStatus(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!cookieInput.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#fa2d48] hover:bg-[#fa2d48]/90 text-white disabled:opacity-40 transition-all shadow-md shadow-[#fa2d48]/20"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
