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
        { id: "new", label: "New", icon: Home },
        { id: "radio", label: "Radio", icon: Home },
        { id: "news", label: "News from dev", icon: Newspaper },
        { id: "search", label: "Search", icon: Search },
      ],
    },
    {
      label: "Library",
      items: [
        { id: "history", label: "Recently Played", icon: Clock3 },
        { id: "artists", label: "Artists", icon: Users },
        { id: "albums", label: "Albums", icon: Disc3 },
        { id: "songs", label: "Songs", icon: Music2 },
      ],
    },
    {
      label: "Playlists",
      items: [
        { id: "playlists", label: "All Playlists", icon: Library },
        { id: "favorites", label: "Favorite Songs", icon: Music2 },
      ],
    },
  ];
  const importSession = async (event) => {
    event.preventDefault();
    if (importing || !cookieInput.trim()) return;
    setImporting(true);
    setImportStatus("");
    try {
      const result = await window.api.auth.importCookie(cookieInput.trim());
      if (!result?.ok)
        throw new Error(result?.error || "Couldn’t connect this session.");
      setShowCookieModal(false);
      setCookieInput("");
    } catch (error) {
      setImportStatus(error.message);
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <aside className="sidebar">
        <FestivalBrand />
        <button
          className="sidebar-search"
          onClick={() => setActiveTab("search")}
        >
          <Search size={14} />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {groups.map((group, index) => (
            <div className="nav-group" key={index}>
              {group.label && <h2>{group.label}</h2>}
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${activeTab === id ? "active" : ""}`}
                  aria-current={activeTab === id ? "page" : undefined}
                  onClick={() => setActiveTab(id)}
                >
                  {iconNames[id] ? (
                    <AndroidIcon
                      name={
                        id === "favorites" && activeTab === id
                          ? "ic_star_filled"
                          : iconNames[id]
                      }
                      size={19}
                    />
                  ) : (
                    <Icon size={19} strokeWidth={1.7} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        {playlists.length > 0 && (
          <div className="sidebar-playlists no-scrollbar">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                className="sidebar-playlist"
                onClick={() => setActiveTab("playlists", { playlist })}
              >
                <Artwork src={playlist.thumbnail} />
                <span>{playlist.title}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className={`nav-item sidebar-settings ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <AndroidIcon name="ic_player_tools" size={18} />
          <span>Settings</span>
        </button>
        <div className="sidebar-account">
          {authLoading ? (
            <div className="account-button">
              <Loader2 size={19} className="animate-spin" />
              <span>Connecting…</span>
            </div>
          ) : userProfile?.isLoggedIn ? (
            <div className="account-button">
              {userProfile.photo ? (
                <img src={userProfile.photo} alt="" />
              ) : (
                <span className="account-avatar">
                  {userProfile.name?.[0] || "U"}
                </span>
              )}
              <span>{userProfile.name || "Your account"}</span>
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
                onClick={onLogout}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <>
              <button className="account-button" onClick={onLogin}>
                <span className="account-avatar google-account-avatar">
                  <img src={GOOGLE_LOGO} alt="" />
                </span>
                <span>Sign In</span>
              </button>
              <button
                className="session-link"
                onClick={() => setShowCookieModal(true)}
              >
                Import existing session
              </button>
            </>
          )}
        </div>
      </aside>
      <AnimatedPresence
        show={showCookieModal}
        duration={250}
        className="presence-modal"
      >
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !importing)
              setShowCookieModal(false);
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-title"
          >
            <div className="section-heading">
              <h2 id="session-title">Connect your session</h2>
              <button
                className="icon-button"
                aria-label="Close session import"
                disabled={importing}
                onClick={() => setShowCookieModal(false)}
              >
                <X size={19} />
              </button>
            </div>
            <p>
              Paste your YouTube Music session cookies to connect your library.
            </p>
            <form onSubmit={importSession}>
              <textarea
                aria-label="Session cookies"
                value={cookieInput}
                onChange={(event) => setCookieInput(event.target.value)}
                placeholder="SAPISID=…; SSID=…"
                rows={5}
                autoFocus
              />
              {importStatus && (
                <p role="alert" className="error-text">
                  {importStatus}
                </p>
              )}
              <button
                className="primary-button"
                disabled={importing || !cookieInput.trim()}
              >
                {importing && <Loader2 size={16} className="animate-spin" />}
                Connect
              </button>
            </form>
          </section>
        </div>
      </AnimatedPresence>
    </>
  );
}
