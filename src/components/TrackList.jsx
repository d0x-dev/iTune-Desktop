import React from "react";
import { Play } from "lucide-react";
import Artwork from "./Artwork";
import FavoriteIcon from "./FavoriteIcon";
import ExplicitTitle from "./ExplicitTitle";
import { getArtistName, formatTime } from "../utils/format";

export default function TrackList({
  tracks = [],
  currentTrack,
  isPlaying,
  onSelectTrack,
  likedSongIds,
  onToggleLike,
  onContextMenu,
}) {
  if (!tracks.length)
    return (
      <div className="empty-state compact">
        <p>No songs here yet.</p>
      </div>
    );
  return (
    <div className="track-table" role="table" aria-label="Songs">
      <div className="track-row track-header" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Song</span>
        <span className="track-album" role="columnheader">
          Album
        </span>
        <span role="columnheader">Time</span>
      </div>
      {tracks.map((track, index) => {
        const videoId = track.videoId || track.id;
        const selected = currentTrack?.id === track.id;
        const liked = likedSongIds?.has(videoId);
        return (
          <div
            className={`track-row ${selected ? "current" : ""}`}
            role="row"
            key={`${track.id}-${index}`}
            onContextMenu={(event) => onContextMenu?.(event, track, tracks)}
          >
            <div className="track-number" role="cell">
              <span>
                {selected && isPlaying ? (
                  <span className="equalizer">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  index + 1
                )}
              </span>
              <button
                className="icon-button"
                aria-label={`Play ${track.title}`}
                onClick={() => onSelectTrack(track, tracks)}
              >
                <Play size={14} fill="currentColor" />
              </button>
            </div>
            <div role="cell">
              <button
                className="track-song"
                onClick={() => onSelectTrack(track, tracks)}
              >
                <Artwork src={track.thumbnail} title="" />
                <span>
                  <strong><ExplicitTitle item={track} /></strong>
                  <small>{getArtistName(track)}</small>
                </span>
              </button>
            </div>
            <div className="track-album" role="cell">
              {track.album?.name || "—"}
            </div>
            <div className="track-end" role="cell">
              {onToggleLike && (
                <button
                  className={`icon-button track-heart ${liked ? "selected" : ""}`}
                  aria-label={`${liked ? "Remove favorite" : "Favorite"} ${track.title}`}
                  onClick={() => onToggleLike(videoId)}
                >
                  <FavoriteIcon filled={liked} size={17} />
                </button>
              )}
              <span>
                {track.duration ||
                  (track.durationSeconds
                    ? formatTime(track.durationSeconds)
                    : "—")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
