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
          onClick={onToggleShuffle}
          aria-label="Shuffle queue"
          aria-pressed={isShuffle}
        >
          <AndroidIcon name="shuffle" size={17} />
        </button>
        <button
          className={endlessQueueEnabled ? "selected" : ""}
          onClick={onToggleEndlessQueue}
          aria-label="Endless queue"
          aria-pressed={endlessQueueEnabled}
        >
          <AndroidIcon name="ic_infinite_queue" size={18} />
        </button>
        <button
          className={repeatMode !== "off" ? "selected" : ""}
          onClick={onToggleRepeat}
          aria-label={`Repeat ${repeatMode}`}
          aria-pressed={repeatMode !== "off"}
        >
          <AndroidIcon
            name={repeatMode === "one" ? "repeat_one" : "repeat"}
            size={17}
          />
        </button>
      </div>
      {queue[currentIndex] && (
        <>
          <h3>Playing Now</h3>
          <QueueTrack
            track={queue[currentIndex]}
            current
            onClick={() => onSelect(queue[currentIndex], queue)}
          />
