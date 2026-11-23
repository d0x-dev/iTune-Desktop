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
