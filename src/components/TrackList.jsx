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
