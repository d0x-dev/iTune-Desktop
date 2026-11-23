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
