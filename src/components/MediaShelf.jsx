import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Artwork from "./Artwork";
import { getArtistName } from "../utils/format";
import AndroidIcon from "./AndroidIcon";
import ExplicitTitle from "./ExplicitTitle";

export default function MediaShelf({
  title,
  items = [],
  onSelect,
  editorial = false,
  layout,
  strapline,
  currentTrack,
  isPlaying,
  heroStyle = "apple",
  onContextMenu,
}) {
  const shelf = useRef(null);
  const shelfLayout =
    layout ||
    (items.every((item) => item.type === "artist") ? "artists" : "cards");
  return (
    <section
      className={`media-section ${editorial ? `editorial-section hero-${heroStyle}` : ""}`}
    >
      <div className="section-heading">
        <div>
          {strapline && <p className="shelf-strapline">{strapline}</p>}
          <h2>{title}</h2>
        </div>
        <div className="shelf-controls">
          <button
            className="icon-button"
            aria-label={`Scroll ${title} left`}
            onClick={() =>
              shelf.current?.scrollBy({
                left: -shelf.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={`Scroll ${title} right`}
            onClick={() =>
              shelf.current?.scrollBy({
                left: shelf.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        className={`media-shelf no-scrollbar ${shelfLayout}-shelf`}
        ref={shelf}
      >
        {items.map((item, index) =>
          shelfLayout === "songs" && !editorial ? (
            <button
