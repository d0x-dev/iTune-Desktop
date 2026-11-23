import React, { useEffect, useRef } from "react";
import { RefreshCw, Loader2, Radio } from "lucide-react";
import { useHomeFeed } from "../utils/homeFeed";
import MediaShelf from "./MediaShelf";
import { usePreferences } from "../utils/preferences";

export default function DiscoveryView({
  kind = "home",
  onSelectTrack,
  userProfile,
  currentTrack,
  isPlaying,
  onStartRadio,
  onBackdropChange,
  onContextMenu,
}) {
  const { preferences } = usePreferences();
  const feed = useHomeFeed(kind, userProfile);
  const sentinel = useRef(null);
  useEffect(() => {
    if (!feed.continuation || feed.error || feed.loadingMore || !sentinel.current)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) feed.loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [feed.continuation, feed.error, feed.loadingMore, feed.loadMore]);
  const title = kind === "new" ? "New" : kind === "radio" ? "Radio" : "Home";
  const allItems = feed.sections.flatMap((section) => section.contents);
