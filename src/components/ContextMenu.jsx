import React, { useEffect, useRef } from "react";
import {
  Album,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  Download,
  Library,
  ListEnd,
  ListPlus,
  Play,
  Radio,
  Settings,
  SkipForward,
} from "lucide-react";
import FavoriteIcon from "./FavoriteIcon";

export default function ContextMenu({
  menu,
  playlists = [],
  isLiked = false,
  onAction,
  onClose,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    const escape = (event) => event.key === "Escape" && onClose();
    addEventListener("pointerdown", close);
    addEventListener("keydown", escape);
    addEventListener("blur", onClose);
    return () => {
      removeEventListener("pointerdown", close);
      removeEventListener("keydown", escape);
      removeEventListener("blur", onClose);
    };
  }, [onClose]);
  if (!menu) return null;

  const item = menu.item;
  const type = String(item?.type || "").toLowerCase();
  const collection =
    item &&
    (/album|artist|playlist|podcast/.test(type) ||
      /^(MPRE|VL|PL|RD|UC|OLAK)/.test(item.id || ""));
  const radioStation = type === "radio";
  const song = item && !collection && !radioStation;
  const invoke = (action, payload) => {
    onAction(action, payload);
    if (action !== "submenu") onClose();
  };

  return (
    <div
      className="apple-context-menu"
      ref={ref}
      role="menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {item ? (
        <>
          <div className="context-menu-title">
            <strong>{item.title || item.name}</strong>
            <span>{radioStation ? "Live Radio" : collection ? item.type : "Song"}</span>
          </div>
          <MenuItem icon={Play} label={collection ? "Open" : "Play"} onClick={() => invoke("play")} />
          {!collection && (
            <>
              <MenuItem icon={SkipForward} label="Play Next" onClick={() => invoke("next")} />
              <MenuItem icon={ListEnd} label="Add to Queue" onClick={() => invoke("queue")} />
            </>
          )}
          {song && (
            <>
              <div className="context-divider" />
              <MenuItem icon={Radio} label="Start Station" onClick={() => invoke("radio")} />
              <MenuItem
                icon={() => <FavoriteIcon filled={isLiked} size={17} />}
                label={isLiked ? "Remove from Favorites" : "Add to Favorites"}
                selected={isLiked}
                onClick={() => invoke("favorite")}
              />
              <div className="context-submenu-wrap">
                <MenuItem icon={Library} label="Add to Playlist" trailing={<ChevronRight size={14} />} />
                <div className="context-submenu">
                  {playlists.length ? (
                    playlists.slice(0, 12).map((playlist) => (
                      <button
                        role="menuitem"
                        key={playlist.id}
                        onClick={() => invoke("playlist", playlist)}
                      >
                        <ListPlus size={15} />
                        <span>{playlist.title}</span>
                      </button>
                    ))
                  ) : (
                    <span className="context-empty">Sign in or create a playlist first</span>
                  )}
                </div>
              </div>
              <MenuItem icon={Download} label="Download Song" onClick={() => invoke("download")} />
            </>
          )}
          <div className="context-divider" />
          {song && item.album?.id && (
            <MenuItem icon={Album} label="Open Album" onClick={() => invoke("album")} />
          )}
          {song && item.artists?.[0]?.id && (
            <MenuItem icon={CircleUserRound} label="Open Artist" onClick={() => invoke("artist")} />
          )}
          <MenuItem icon={Copy} label="Copy Link" onClick={() => invoke("copy")} />
        </>
      ) : (
        <>
          <MenuItem icon={Clock3} label="Recently Played" onClick={() => invoke("history")} />
          <MenuItem icon={Library} label="Your Library" onClick={() => invoke("library")} />
          <div className="context-divider" />
          <MenuItem icon={Settings} label="Settings" onClick={() => invoke("settings")} />
        </>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, trailing, selected }) {
  return (
    <button role="menuitem" onClick={onClick} className={selected ? "selected" : ""}>
      <Icon size={15} fill={selected ? "currentColor" : "none"} />
      <span>{label}</span>
      {trailing}
    </button>
  );
}
