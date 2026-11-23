import React from "react";
import { X, ListMusic } from "lucide-react";
import Artwork from "./Artwork";
import ExplicitTitle from "./ExplicitTitle";
import AndroidIcon from "./AndroidIcon";
import { getArtistName } from "../utils/format";

export default function QueuePanel({
  queue,
  currentIndex,
  onSelect,
  onClose,
  isShuffle,
  onToggleShuffle,
  endlessQueueEnabled,
  onToggleEndlessQueue,
  repeatMode,
  onToggleRepeat,
}) {
  return (
    <aside className="queue-panel" aria-label="Up Next">
      <div className="section-heading">
        <h2>Up Next</h2>
        <button
          className="icon-button"
          aria-label="Close queue"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="queue-mode-controls" aria-label="Queue playback modes">
        <button
          className={isShuffle ? "selected" : ""}
